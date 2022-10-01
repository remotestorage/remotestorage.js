import 'mocha';
import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import {requestWithTimeout} from "../../src/requests";
import config from "../../src/config";

chai.use(chaiAsPromised);

describe("request", () => {
  describe("requestWithTimeout", () => {
    const originalTimeout = config.requestTimeout;

    beforeEach(() => {
      fetchMock.reset();
    });

    afterEach(() => {
      config.requestTimeout = originalTimeout;
    });

    it("aborts requests if they don't resolve by the configured timeout", async () => {
      config.requestTimeout = 20;
      const URL = 'https://example.edu/';

      fetchMock.mock({name: 'getFile', url: URL}, {status: 200, body: "Hello"}, {delay: 10_000});
      await expect(requestWithTimeout('GET', URL, {})).to.be.rejectedWith(/timeout/);
    });

    it("fulfills requests, when they return before timeout", async () => {
      const URL = 'https://example.io/';
      const BODY = 'Goodbye!'

      fetchMock.mock({name: 'getFile', url: URL}, {status: 200, body: BODY});
      await expect(requestWithTimeout('GET', URL, {})).to.eventually.be.an('object').with.property('response', BODY);
    });
  });
});

