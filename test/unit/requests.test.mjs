import 'mocha';
import * as chai from "chai";
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fetchMock from 'fetch-mock';

import config from "../../build/config.js";
import { requestWithTimeout } from "../../build/requests.js";

chai.use(chaiAsPromised);

describe("request helpers", () => {
  describe("requestWithTimeout", () => {
    const originalTimeout = config.requestTimeout;

    before(() => {
      config.requestTimeout = 20;
    });

    after(() => {
      config.requestTimeout = originalTimeout;
    });

    afterEach(() => {
      fetchMock.reset();
    });

    it("aborts requests if they don't resolve by the configured timeout", async () => {
      const URL = 'https://example.edu/';

      fetchMock.mock(
        { name: 'getFile', url: URL },
        { status: 200, body: "Hello" },
        { delay: 30 }
      );

      await expect(requestWithTimeout('GET', URL, {})).to
        .be.rejectedWith(/timeout/);
    });

    it("fulfills requests, when they return before timeout", async () => {
      const URL = 'https://example.io/';
      const BODY = 'Goodbye!';

      fetchMock.mock(
        { name: 'getFile', url: URL },
        { status: 200, body: BODY }
      );

      await expect(requestWithTimeout('GET', URL, {})).to
        .eventually.be.an('object').with.property('response', BODY);
    });

    describe('XMLHttpRequest fallback', () => {
      let originalFetch;
      let originalXMLHttpRequest;

      beforeEach(() => {
        originalFetch = globalThis.fetch;
        originalXMLHttpRequest = globalThis.XMLHttpRequest;
        globalThis.fetch = undefined;
      });

      afterEach(() => {
        globalThis.fetch = originalFetch;
        globalThis.XMLHttpRequest = originalXMLHttpRequest;
      });

      it('sends requests via XMLHttpRequest when fetch is unavailable', async () => {
        const URL = 'https://example.net/';
        const instances = [];

        class MockXMLHttpRequest {
          constructor() {
            this.headers = {};
            instances.push(this);
          }

          open(method, url, async) {
            this.openArgs = { method, url, async };
          }

          setRequestHeader(name, value) {
            this.headers[name] = value;
          }

          send(body) {
            this.body = body;
          }
        }

        globalThis.XMLHttpRequest = MockXMLHttpRequest;
        const requestPromise = requestWithTimeout('POST', URL, {
          body: 'Hello!',
          headers: { Authorization: 'Bearer token' }
        });
        const xhr = instances[0];

        expect(xhr.openArgs).to.deep.equal({ method: 'POST', url: URL, async: true });
        expect(xhr.headers).to.deep.equal({ Authorization: 'Bearer token' });
        expect(xhr.body).to.equal('Hello!');

        xhr.onload();
        await expect(requestPromise).to.eventually.equal(xhr);
      });

      it('rejects when XMLHttpRequest reports an error', async () => {
        const networkError = new Error('Network error');

        class MockXMLHttpRequest {
          open() {}
          send() {
            this.onerror(networkError);
          }
        }

        globalThis.XMLHttpRequest = MockXMLHttpRequest;

        await expect(requestWithTimeout('GET', 'https://example.org/', {})).to
          .be.rejectedWith(networkError);
      });
    });
  });
});
