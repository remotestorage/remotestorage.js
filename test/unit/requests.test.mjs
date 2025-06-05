import 'mocha';
import chai, { expect } from 'chai';
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
  });
});
