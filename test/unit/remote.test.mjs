import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import { RemoteBase } from '../../build/remote.js';
import { RemoteStorage } from '../../build/remotestorage.js';

chai.use(chaiAsPromised);

const TOKEN_URL = 'https://example.com/oauth2/token';
const REFRESH_TOKEN = '7-_IbSBsp5wAAA';

class MockRemote extends RemoteBase {
  constructor(rs) {
    super(rs);
    this.TOKEN_URL = TOKEN_URL;
    this.clientId = 'client';
  }
}

describe('RemoteBase token refresh', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  it('refreshes the access token and stores the new tokens without configure()', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'new', token_type: 'bearer', refresh_token: 'r0tated' }) }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.equal('new');
    expect(remote.token).to.equal('new');
    expect(remote.refreshToken).to.equal('r0tated');
    expect(remote.tokenType).to.equal('bearer');
    expect(storeTokensSpy.callCount).to.equal(1);
    expect(storeTokensSpy.getCall(0).args).to.deep.equal(['new', 'r0tated', 'bearer']);
  });

  it('keeps the refresh token when the server doesn\'t rotate it', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'new' }) }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.equal('new');
    expect(remote.token).to.equal('new');
    expect(remote.refreshToken).to.equal(REFRESH_TOKEN);
    expect(storeTokensSpy.getCall(0).args).to.deep.equal(['new', undefined, undefined]);
  });

  for (const status of [500, 429]) {
    it(`keeps the tokens on a transient server error (${status})`, async () => {
      const remote = new MockRemote(new RemoteStorage());
      remote.token = 'old-token';
      remote.refreshToken = REFRESH_TOKEN;
      const storeTokensSpy = sinon.spy(remote, '_storeTokens');
      fetchMock.mock(
        { name: 'postToken', method: 'POST', url: TOKEN_URL },
        { status, body: JSON.stringify({ error: 'server_error' }) }
      );

      const result = await remote._refreshAfter401('old-token');

      expect(result).to.be.null;
      expect(storeTokensSpy.called).to.equal(false);
      expect(remote.token).to.equal('old-token');
      expect(remote.refreshToken).to.equal(REFRESH_TOKEN);
    });
  }

  it('keeps the tokens on a network error', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { throws: new TypeError('Failed to fetch') }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.be.null;
    expect(storeTokensSpy.called).to.equal(false);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.equal(REFRESH_TOKEN);
  });

  it('keeps the tokens when a successful refresh has no access_token', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({}) }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.be.null;
    expect(storeTokensSpy.called).to.equal(false);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.equal(REFRESH_TOKEN);
  });

  it('clears only the refresh token when the server rejects it', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.be.null;
    expect(storeTokensSpy.callCount).to.equal(1);
    expect(storeTokensSpy.getCall(0).args).to.deep.equal(['old-token', null]);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.be.null;
  });

  it('does not clear a refresh token another refresh already replaced', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'newer-token';
    remote.refreshToken = 'rotated-token';
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
    );

    const result = await remote._refreshAfter401(REFRESH_TOKEN);

    expect(result).to.be.null;
    expect(storeTokensSpy.called).to.equal(false);
    expect(remote.token).to.equal('newer-token');
    expect(remote.refreshToken).to.equal('rotated-token');
  });

  it('does not overwrite tokens when the session changed during the refresh', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      () => {
        remote.token = 'session2-token';
        remote.refreshToken = 'session2-refresh';
        return { status: 200, body: JSON.stringify({ access_token: 'stale', refresh_token: 'stale-refresh' }) };
      }
    );

    const result = await remote._refreshAfter401('old-token');

    expect(result).to.be.null;
    expect(storeTokensSpy.called).to.equal(false);
    expect(remote.token).to.equal('session2-token');
    expect(remote.refreshToken).to.equal('session2-refresh');
  });

  it('shares one in-flight refresh between concurrent callers of a session', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'new', token_type: 'bearer' }) }
    );

    const [first, second] = await Promise.all([
      remote._refreshAfter401('old-token'),
      remote._refreshAfter401('old-token')
    ]);

    expect(first).to.equal('new');
    expect(second).to.equal('new');
    expect(fetchMock.calls('postToken')).to.have.lengthOf(1);
    // The whole operation is shared, so the token is stored exactly once
    expect(storeTokensSpy.callCount).to.equal(1);
  });

  it('forgets a shared rejected refresh token exactly once', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
    );

    const results = await Promise.all([
      remote._refreshAfter401('old-token'),
      remote._refreshAfter401('old-token')
    ]);

    expect(results).to.deep.equal([null, null]);
    expect(fetchMock.calls('postToken')).to.have.lengthOf(1);
    // Only the session's rejected refresh token is forgotten, once
    expect(storeTokensSpy.callCount).to.equal(1);
    expect(storeTokensSpy.getCall(0).args).to.deep.equal(['old-token', null]);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.be.null;
  });

  it('returns the token for a late 401 after a refresh completed', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'new', token_type: 'bearer' }) }
    );

    expect(await remote._refreshAfter401('old-token')).to.equal('new');
    expect(await remote._refreshAfter401('old-token')).to.equal('new');

    // A request sent with the old token is retried with the new one
    expect(fetchMock.calls('postToken')).to.have.lengthOf(1);
    expect(storeTokensSpy.callCount).to.equal(1);
  });

  it('returns null when the refresh returns the same token', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'old-token', token_type: 'bearer', refresh_token: 'rotated' }) }
    );

    const result = await remote._refreshAfter401('old-token');

    // The caller must not retry with the same token
    expect(result).to.be.null;
    expect(storeTokensSpy.callCount).to.equal(1);
    expect(storeTokensSpy.getCall(0).args).to.deep.equal(['old-token', 'rotated', 'bearer']);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.equal('rotated');
  });

  it('returns null to concurrent callers when the refresh returns the same token', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 'old-token';
    remote.refreshToken = REFRESH_TOKEN;
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    fetchMock.mock(
      { name: 'postToken', method: 'POST', url: TOKEN_URL },
      { status: 200, body: JSON.stringify({ access_token: 'old-token', token_type: 'bearer', refresh_token: 'rotated' }) }
    );

    const results = await Promise.all([
      remote._refreshAfter401('old-token'),
      remote._refreshAfter401('old-token')
    ]);

    expect(results).to.deep.equal([null, null]);
    expect(fetchMock.calls('postToken')).to.have.lengthOf(1);
    expect(storeTokensSpy.callCount).to.equal(1);
    expect(remote.token).to.equal('old-token');
    expect(remote.refreshToken).to.equal('rotated');
  });

  it('keeps a newer session\'s in-flight refresh after an older one settles', async () => {
    const remote = new MockRemote(new RemoteStorage());
    remote.token = 't1';
    remote.refreshToken = 'r1';
    const storeTokensSpy = sinon.spy(remote, '_storeTokens');
    const resolvers = [];
    fetchMock.mock({ name: 'postToken', method: 'POST', url: TOKEN_URL }, () => {
      return new Promise(resolve => { resolvers.push(resolve); });
    });

    const first = remote._refreshAfter401('t1');
    // A replacement session starts its own refresh before the first settles
    remote.token = 't2';
    remote.refreshToken = 'r2';
    const second = remote._refreshAfter401('t2');
    const third = remote._refreshAfter401('t2');

    // Wait for both refresh grants to be issued
    await Promise.resolve();
    expect(resolvers).to.have.lengthOf(2);

    resolvers[0]({ status: 200, body: JSON.stringify({ access_token: 't1-new', token_type: 'bearer' }) });
    expect(await first).to.be.null;

    // The older refresh's cleanup must not clear the newer session's entry:
    // a fourth caller still joins it without a new grant
    const fourth = remote._refreshAfter401('t2');
    expect(fetchMock.calls('postToken')).to.have.lengthOf(2);

    resolvers[1]({ status: 200, body: JSON.stringify({ access_token: 't2-new', token_type: 'bearer' }) });
    expect(await second).to.equal('t2-new');
    expect(await third).to.equal('t2-new');
    expect(await fourth).to.equal('t2-new');
    expect(storeTokensSpy.callCount).to.equal(1);
  });
});
