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
      sessionStorage.setItem('remotestorage:state', 'unused');

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
      expect(sessionStorage.getItem('remotestorage:state')).to.be.null;
    });

    describe("with a stored PKCE transaction", () => {
      const STATE = 'r4nd0m';
      const STORED_TOKEN_URL = 'https://storage.example/token';

      function setUp () {
        const rs = new RemoteStorage();
        const mockRemote = new MockRemote(rs);
        mockRemote.clientId = 'remote-client-id';
        mockRemote.on = () => {};
        mockRemote._emit = () => {};
        const configureSpy = sinon.spy(mockRemote, 'configure');
        const errorSpy = sinon.spy();
        rs.on('error', errorSpy);
        rs.remote = mockRemote;
        rs.setBackend('remotestorage');
        return { rs, configureSpy, errorSpy };
      }

      function storeTransaction (appHash) {
        document.location.href = 'https://example.org/app/' + (appHash || '');
        Authorize.savePkceTransaction({
          codeVerifier: 'v3r1f13r', state: STATE,
          tokenURL: STORED_TOKEN_URL, clientId: 'https://example.org'
        });
      }

      function expectNoTransaction () {
        for (const key of ['codeVerifier', 'state', 'tokenURL', 'clientId', 'appState']) {
          expect(sessionStorage.getItem(`remotestorage:${key}`), key).to.be.null;
        }
      }

      it("posts to the stored token endpoint with the stored client id", async () => {
        storeTransaction();
        document.location.href = `https://example.org/app/?code=c0de&state=${STATE}`;
        fetchMock.mock(
          { name: 'postToken', method: 'POST', url: STORED_TOKEN_URL },
          { status: 200, body: JSON.stringify({ access_token: 'tok', token_type: 'bearer' }) }
        );
        const { rs, configureSpy } = setUp();

        rs._handlers['features-loaded'][0]();
        await new Promise(resolve => setTimeout(resolve, 10));

        const calls = fetchMock.calls('postToken');
        expect(calls).to.have.lengthOf(1);
        const body = new URLSearchParams(calls[0][1].body);
        expect(body.get('client_id')).to.equal('https://example.org');
        expect(body.get('code_verifier')).to.equal('v3r1f13r');
        expect(configureSpy.getCall(0).args[0]).to.have.property('token', 'tok');
        expectNoTransaction();
      });

      it("restores the app's hash instead of putting the random state in it", async () => {
        storeTransaction('#/notes/42');
        document.location.href = `https://example.org/app/?code=c0de&state=${STATE}`;
        fetchMock.mock(
          { method: 'POST', url: STORED_TOKEN_URL },
          { status: 200, body: JSON.stringify({ access_token: 'tok' }) }
        );
        const { rs } = setUp();

        rs._handlers['features-loaded'][0]();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(document.location.hash).to.equal('#/notes/42');
      });

      it("rejects a mismatched state without exchanging the code", async () => {
        storeTransaction();
        document.location.href = 'https://example.org/app/?code=c0de&state=forged';
        fetchMock.mock({ name: 'postToken', method: 'POST', url: STORED_TOKEN_URL }, 200);
        const { rs, configureSpy, errorSpy } = setUp();

        rs._handlers['features-loaded'][0]();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(fetchMock.calls('postToken')).to.have.lengthOf(0);
        expect(configureSpy.called).to.equal(false);
        expect(errorSpy.calledOnce).to.equal(true);
        expect(errorSpy.getCall(0).args[0].message).to.match(/state mismatch/);
        expect(document.location.hash).to.equal('');
        expectNoTransaction();
      });

      it("rejects a missing state without exchanging the code", async () => {
        storeTransaction();
        document.location.href = 'https://example.org/app/?code=c0de';
        fetchMock.mock({ name: 'postToken', method: 'POST', url: STORED_TOKEN_URL }, 200);
        const { rs, errorSpy } = setUp();

        rs._handlers['features-loaded'][0]();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(fetchMock.calls('postToken')).to.have.lengthOf(0);
        expect(errorSpy.calledOnce).to.equal(true);
        expectNoTransaction();
      });

      it("restores the app's hash and clears the transaction when authorization is denied", () => {
        storeTransaction('#/notes/42');
        document.location.href = `https://example.org/app/?error=access_denied&state=${STATE}`;
        const { rs } = setUp();

        expect(() => rs._handlers['features-loaded'][0]()).to.throw('access denied');

        expect(document.location.hash).to.equal('#/notes/42');
        expectNoTransaction();
      });

      it("clears the transaction when the token request fails", async () => {
        storeTransaction();
        document.location.href = `https://example.org/app/?code=c0de&state=${STATE}`;
        fetchMock.mock(
          { method: 'POST', url: STORED_TOKEN_URL },
          { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
        );
        const { rs, errorSpy } = setUp();

        rs._handlers['features-loaded'][0]();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(errorSpy.calledOnce).to.equal(true);
        expectNoTransaction();
      });
    });
  });

  describe("PKCE transaction", () => {
    it("replaces an abandoned transaction, so its token endpoint can't leak into the next one", () => {
      Authorize.savePkceTransaction({
        codeVerifier: 'first', state: 's1',
        tokenURL: 'https://storage.example/token', clientId: 'https://foo'
      });
      // e.g. the user gave up at the server above, then connected Dropbox
      Authorize.savePkceTransaction({ codeVerifier: 'second', state: 's2' });

      expect(Authorize.takePkceTransaction()).to.deep.equal({
        codeVerifier: 'second', state: 's2',
        tokenURL: undefined, clientId: undefined, appState: undefined
      });
    });

    it("leaves nothing behind when sessionStorage rejects a write", () => {
      // On the prototype: Node 26's built-in Storage would store an own
      // property as an item rather than use it as a method.
      const setItem = sinon.stub(Object.getPrototypeOf(sessionStorage), 'setItem');
      setItem.callThrough();
      setItem.withArgs('remotestorage:tokenURL').throws(new Error('QuotaExceededError'));

      try {
        expect(() => Authorize.savePkceTransaction({
          codeVerifier: 'v', state: 's', tokenURL: 'https://storage.example/token'
        })).to.throw('QuotaExceededError');
      } finally {
        setItem.restore();
      }

      expect(sessionStorage.getItem('remotestorage:codeVerifier')).to.be.null;
      expect(sessionStorage.getItem('remotestorage:state')).to.be.null;
    });
  });

  describe("RemoteStorage#_authorize", () => {
    const pkceInfo = {
      href: 'https://storage.example/alice',
      storageApi: 'draft-dejong-remotestorage-27',
      authURL: 'https://storage.example/oauth/implicit',
      authorizationURL: 'https://storage.example/oauth/authorize',
      tokenURL: 'https://storage.example/oauth/token',
      pkceMethods: 'S256',
      properties: {}
    };

    let rs;

    function createRs () {
      rs = new RemoteStorage();
      rs.access.claim('notes', 'rw');
      return rs;
    }

    afterEach(() => {
      delete globalThis.cordova;
      rs.disconnect();
    });

    it("uses the code flow and stores the transaction when PKCE is advertised", async () => {
      document.location.href = 'https://example.org/app/#/notes';
      const rs = createRs();

      await rs._authorize(pkceInfo);

      const url = new URL(document.location.href);
      expect(url.origin + url.pathname).to.equal(pkceInfo.authorizationURL);
      expect(url.searchParams.get('response_type')).to.equal('code');
      expect(url.searchParams.get('code_challenge_method')).to.equal('S256');
      expect(url.searchParams.get('client_id')).to.equal('https://example.org');
      expect(url.searchParams.get('state')).to.equal(sessionStorage.getItem('remotestorage:state'));
      expect(sessionStorage.getItem('remotestorage:codeVerifier')).to.be.a('string');
      expect(sessionStorage.getItem('remotestorage:tokenURL')).to.equal(pkceInfo.tokenURL);
      expect(sessionStorage.getItem('remotestorage:clientId')).to.equal('https://example.org');
      expect(sessionStorage.getItem('remotestorage:appState')).to.equal('/notes');
    });

    it("uses the implicit flow when PKCE is not advertised", async () => {
      document.location.href = 'https://example.org/app/';
      const rs = createRs();

      await rs._authorize({ ...pkceInfo, pkceMethods: undefined });

      const url = new URL(document.location.href);
      expect(url.origin + url.pathname).to.equal(pkceInfo.authURL);
      expect(url.searchParams.get('response_type')).to.equal('token');
      expect(sessionStorage.getItem('remotestorage:codeVerifier')).to.be.null;
      expect(sessionStorage.getItem('remotestorage:clientId')).to.be.null;
    });

    it("uses the implicit flow in Cordova, whose InAppBrowser path only handles tokens", async () => {
      globalThis.cordova = {};
      document.location.href = 'https://example.org/app/';
      const rs = createRs();
      const authorizeStub = sinon.stub(Authorize, 'authorize');

      try {
        await rs._authorize(pkceInfo);
      } finally {
        authorizeStub.restore();
      }

      expect(authorizeStub.calledOnce).to.equal(true);
      expect(authorizeStub.getCall(0).args[1].authURL).to.equal(pkceInfo.authURL);
      expect(authorizeStub.getCall(0).args[1].response_type).to.be.undefined;
      expect(sessionStorage.getItem('remotestorage:codeVerifier')).to.be.null;
    });

    it("falls back to the implicit flow when browser storage rejects writes", async () => {
      document.location.href = 'https://example.org/app/';
      const rs = createRs();
      const authorizeStub = sinon.stub(Authorize, 'authorize');
      // On the prototype, as in the rollback test above (Node 26's built-in Storage)
      const setItem = sinon.stub(Object.getPrototypeOf(localStorage), 'setItem').throws(new Error('SecurityError'));

      try {
        await rs._authorize(pkceInfo);
      } finally {
        setItem.restore();
        authorizeStub.restore();
      }

      expect(authorizeStub.calledOnce).to.equal(true);
      expect(authorizeStub.getCall(0).args[1].authURL).to.equal(pkceInfo.authURL);
      expect(authorizeStub.getCall(0).args[1].response_type).to.be.undefined;
    });

    it("emits an error instead of redirecting when a PKCE-only server can't use PKCE", async () => {
      globalThis.cordova = {};
      const rs = createRs();
      const authorizeStub = sinon.stub(Authorize, 'authorize');
      const errorSpy = sinon.spy();
      rs.on('error', errorSpy);

      try {
        await rs._authorize({ ...pkceInfo, authURL: undefined });
      } finally {
        authorizeStub.restore();
      }

      expect(authorizeStub.called).to.equal(false);
      expect(errorSpy.calledOnce).to.equal(true);
      expect(errorSpy.getCall(0).args[0].message).to.match(/only offers the PKCE flow.*Cordova/);
    });

    it("falls back to the implicit flow when sessionStorage rejects the transaction", async () => {
      document.location.href = 'https://example.org/app/';
      const rs = createRs();
      const saveStub = sinon.stub(Authorize, 'savePkceTransaction').throws(new Error('QuotaExceededError'));

      try {
        await rs._authorize(pkceInfo);
      } finally {
        saveStub.restore();
      }

      const url = new URL(document.location.href);
      expect(url.origin + url.pathname).to.equal(pkceInfo.authURL);
      expect(url.searchParams.get('response_type')).to.equal('token');
    });
  });
});
