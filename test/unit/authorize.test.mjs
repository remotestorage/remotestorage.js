import 'mocha';
import * as chai from "chai";
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import { localStorage, sessionStorage } from '../helpers/memoryStorage.mjs';
import locationFactory from "../helpers/location.mjs";

import { Authorize } from '../../build/authorize.js';
import { localStorageAvailable } from "../../build/util.js";
import { RemoteBase } from "../../build/remote.js";
import { RemoteStorage } from '../../build/remotestorage.js';

chai.use(chaiAsPromised);

const WIRECLIENT_SETTINGS_KEY = 'remotestorage:wireclient';
const DISCOVER_SETTINGS_KEY = 'remotestorage:discover';
const AUTHORIZED_SCOPE_KEY = 'remotestorage:authorized-scope';
const PENDING_SCOPE_KEY = 'remotestorage:pending-scope';
const AUTH_URL = 'https://example.com/oauth2/authorize';
const TOKEN_URL = 'https://example.com/oauth2/token';
const REFRESH_TOKEN = '7-_IbSBsp5wAAA';

class MockRemote extends RemoteBase {
  TOKEN_URL = TOKEN_URL;
  clientId = '';

  configure(/* settings */) {
    return Promise.resolve();
  }

  delete(/* path, options */) {
    return Promise.resolve({statusCode: 200});
  }

  get(/* path, options */) {
    return Promise.resolve({statusCode: 200});
  }

  put(/* path, body, contentType, options */) {
    return Promise.resolve({statusCode: 200});
  }
}

function createStorage(remote) {
  return {
    _handlers: {
      'features-loaded': []
    },
    remote,
    on(eventName, handler) {
      this._handlers[eventName].push(handler);
    },
    removeEventListener(eventName, handler) {
      this._handlers[eventName] = this._handlers[eventName].filter((item) => item !== handler);
    }
  };
}

locationFactory('https://foo/bar');
globalThis.localStorageAvailable = localStorageAvailable;
globalThis["sessionStorage"] = sessionStorage;

describe("Authorize", () => {
  beforeEach( () => {
    globalThis.document.location.href = 'https://foo/bar';
  });

  afterEach(() => {
    fetchMock.reset();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("#authorize", () => {
    it("redirects to the provider's OAuth location using PKCE parameters", async () => {
      const rs = new RemoteStorage();
      const options = {
        authURL: AUTH_URL,
        scope: 'notes:rw',
        redirectUri: 'https://note.app.com/#CSRF-protection',
        clientId: 'opaque',
        code_challenge: 'ABCDEFGHI',
        code_challenge_method: 'plain'
      };

      Authorize.authorize(rs, options);

      const expectedUrl = AUTH_URL + '?redirect_uri=https%3A%2F%2Fnote.app.com%2F&scope=notes%3Arw&client_id=opaque&state=CSRF-protection&response_type=token&code_challenge=ABCDEFGHI&code_challenge_method=plain';
      expect(document.location.href).to.equal(expectedUrl);
      expect(JSON.parse(localStorage.getItem(PENDING_SCOPE_KEY))).to.deep.equal({
        backend: 'remotestorage',
        scope: 'notes:rw'
      });
    });
  });

  describe("#refreshAccessToken", () => {
    it("clears the access token on start & sets it on success", async () => {
      const rs = new RemoteStorage();
      const mockRemote = new MockRemote(rs);
      const configureSpy = sinon.spy(mockRemote, 'configure');

      const newAccessToken = 'ALLTHETHINGS';
      const tokenResponse = {
        access_token: newAccessToken,
        expires_in: 14_400,
        token_type: 'bearer',
        scope: 'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write',
        account_id: 'dbid:AAH4f99',
        refresh_token: REFRESH_TOKEN,
      };
      fetchMock.mock(
        { name: 'postToken', method: 'POST', url: TOKEN_URL },
        { status: 200, body:JSON.stringify(tokenResponse) }
      );

      await Authorize.refreshAccessToken(rs, mockRemote, REFRESH_TOKEN);

      expect(configureSpy.callCount).to.equal(2);
      expect(configureSpy.getCall(0).args[0]).to.have.property('token', null);
      expect(configureSpy.getCall(1).args[0]).to.have.property('token', newAccessToken);
    });
  });

  describe("'features-loaded' handler", () => {
    it("preserves hash routes that are not OAuth callbacks", () => {
      const mockRemote = new MockRemote({});
      const stopWaitingForTokenSpy = sinon.spy();
      mockRemote.stopWaitingForToken = stopWaitingForTokenSpy;
      const rs = createStorage(mockRemote);
      rs.remote = mockRemote;
      document.location.href = 'https://example.com/#/todos';

      Authorize._rs_init(rs);

      expect(document.location.hash).to.equal('#/todos');

      rs._handlers['features-loaded'][0]();

      expect(stopWaitingForTokenSpy.calledOnce).to.equal(true);
      expect(document.location.hash).to.equal('#/todos');
    });

    it("clears OAuth callback params from the hash during init", () => {
      const mockRemote = new MockRemote({});
      const rs = createStorage(mockRemote);
      rs.remote = mockRemote;
      document.location.href = 'https://example.com/#access_token=foo&state=bar';

      Authorize._rs_init(rs);

      expect(document.location.hash).to.equal('');
    });

    it("ignores non-auth hash params that happen to contain an equals sign", () => {
      const mockRemote = new MockRemote({});
      const stopWaitingForTokenSpy = sinon.spy();
      mockRemote.stopWaitingForToken = stopWaitingForTokenSpy;
      const rs = createStorage(mockRemote);
      rs.remote = mockRemote;
      document.location.href = 'https://example.com/#foo=bar';

      Authorize._rs_init(rs);

      expect(document.location.hash).to.equal('#foo=bar');

      rs._handlers['features-loaded'][0]();

      expect(stopWaitingForTokenSpy.calledOnce).to.equal(true);
      expect(document.location.hash).to.equal('#foo=bar');
    });

    it("when it sees a code but no code verifier, doesn't call remote.configure()", async () => {
      const rs = new RemoteStorage();
      const mockRemote = new MockRemote(rs);
      mockRemote.on = () => {};
      mockRemote._emit = () => {};
      const configureSpy = sinon.spy(mockRemote, 'configure');
      rs.remote = mockRemote;
      rs.setBackend(undefined);
      document.location.href = 'https://example.com/?code=foo&state=bar';
      Authorize._rs_init(rs);

      rs._handlers['features-loaded'][0]();

      expect(configureSpy.called).to.equal(false);
    });

    it("when it sees a code & code verifier, calls the token endpoint & sets the access token", async () => {
      const CODE_VERIFIER = '5lk40gfpjfp4p9';
      sessionStorage.setItem('remotestorage:codeVerifier', CODE_VERIFIER);

      const REDIRECT_URI = 'https://example.org/app/';
      const CODE = 'fubar';
      document.location.href = `${REDIRECT_URI}?code=${CODE}&state=unused`;

      const newAccessToken = 'TIMEFORSOMETHINGNEW';
      const tokenResponse = {
        access_token: newAccessToken,
        expires_in: 14_400,
        token_type: 'bearer',
        scope: 'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write',
        account_id: 'dbid:AAH4f99',
        refresh_token: REFRESH_TOKEN,
      };
      fetchMock.mock(
        {name: 'postToken', method: 'POST', url: TOKEN_URL},
        {status: 200, body: JSON.stringify(tokenResponse)}
      );

      const rs = new RemoteStorage();
      const mockRemote = new MockRemote(rs);
      mockRemote.clientId = 'lk4508vj40';
      mockRemote.on = () => {};
      mockRemote._emit = () => {};
      const configureSpy = sinon.spy(mockRemote, 'configure');
      rs.remote = mockRemote;
      rs.setBackend('remotestorage');
      localStorage.setItem(PENDING_SCOPE_KEY, JSON.stringify({
        backend: 'remotestorage',
        scope: 'documents:r notes:rw'
      }));

      rs._handlers['features-loaded'][0]();

      await new Promise(resolve => setTimeout(resolve, 10));
      const calls = fetchMock.calls('postToken');
      expect(calls).to.have.lengthOf(1);
      expect(calls[0][1].headers).not.to.have.property('Authorization');
      expect(calls[0][1].headers).to.have.property('Content-Type').which.equals('application/x-www-form-urlencoded');
      const formValues = new URLSearchParams({
        code: CODE,
        grant_type: 'authorization_code',
        client_id: rs.remote.clientId,
        redirect_uri: REDIRECT_URI,
        code_verifier: CODE_VERIFIER
      });
      expect(calls[0][1].body).to.equal(formValues.toString());

      expect(configureSpy.callCount).to.equal(1);
      expect(configureSpy.getCall(0).args[0]).to.deep.equal({
        refreshToken: REFRESH_TOKEN,
        token: newAccessToken,
        tokenType: 'bearer'
      });
      expect(JSON.parse(localStorage.getItem(AUTHORIZED_SCOPE_KEY))).to.deep.equal({
        backend: 'remotestorage',
        scope: 'documents:r notes:rw'
      });
      expect(localStorage.getItem(PENDING_SCOPE_KEY)).to.be.null;
      expect(sessionStorage.getItem('remotestorage:codeVerifier')).to.be.null;
    });
  });
});
