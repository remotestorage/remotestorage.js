import 'mocha';
import * as chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fetchMock from 'fetch-mock';

import { requestRefreshedToken } from '../../build/oauth/token-refresh.js';

chai.use(chaiAsPromised);

const TOKEN_URL = 'https://example.com/oauth2/token';
const REFRESH_TOKEN = '7-_IbSBsp5wAAA';

describe('token refresh', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  describe('#requestRefreshedToken', () => {
    it('returns the new tokens without touching a remote', async () => {
      fetchMock.mock(
        { name: 'postToken', method: 'POST', url: TOKEN_URL },
        { status: 200, body: JSON.stringify({ access_token: 'new', token_type: 'bearer', refresh_token: 'r0tated' }) }
      );

      const refreshed = await requestRefreshedToken(TOKEN_URL, 'client', REFRESH_TOKEN);

      expect(refreshed).to.deep.equal({ token: 'new', tokenType: 'bearer', refreshToken: 'r0tated' });
      const body = new URLSearchParams(fetchMock.calls('postToken')[0][1].body);
      expect(body.get('grant_type')).to.equal('refresh_token');
      expect(body.get('client_id')).to.equal('client');
      expect(body.get('refresh_token')).to.equal(REFRESH_TOKEN);
    });

    it('throws Unauthorized only when the refresh token is rejected (invalid_grant)', async () => {
      fetchMock.mock(
        { method: 'POST', url: TOKEN_URL },
        { status: 400, body: JSON.stringify({ error: 'invalid_grant' }) }
      );

      await expect(requestRefreshedToken(TOKEN_URL, 'client', REFRESH_TOKEN))
        .to.be.rejected.and.eventually.have.property('name', 'Unauthorized');
    });

    for (const [failure, response] of [
      ['a server error', { status: 500, body: JSON.stringify({ error: 'server_error' }) }],
      ['rate limiting', { status: 429, body: JSON.stringify({ error: 'slow_down' }) }],
      ['a success without an access token', { status: 200, body: JSON.stringify({}) }],
      ['a success with an access token that is not a string', { status: 200, body: JSON.stringify({ access_token: 123 }) }]
    ]) {
      it(`throws a plain error on ${failure}, which says nothing about the refresh token`, async () => {
        fetchMock.mock({ method: 'POST', url: TOKEN_URL }, response);

        const err = await requestRefreshedToken(TOKEN_URL, 'client', REFRESH_TOKEN)
          .then(() => null, e => e);

        expect(err).to.be.an('error');
        expect(err.name).not.to.equal('Unauthorized');
      });
    }
  });
});
