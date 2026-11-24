import log from '../log';
import { requestWithTimeout } from '../requests';
import UnauthorizedError from '../unauthorized-error';

/** What a token endpoint returns for a refresh token */
export interface RefreshedToken {
  token: string;
  tokenType?: string;
  /** A rotated refresh token, when the server issues one */
  refreshToken?: string;
}

/** POST a refresh_token grant to the token endpoint */
function postRefreshGrant (tokenURL: string, clientId: string, refreshToken: string): Promise<XMLHttpRequest> {
  const formValues = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });
  return requestWithTimeout('POST', tokenURL, {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: formValues.toString(),
    responseType: 'json'
  });
}

/**
 * Exchange a refresh token for a new access token, without touching any
 * remote, so the caller decides whether the result still applies.
 *
 * Throws `Unauthorized` only when the server rejects the refresh token
 * (`invalid_grant`, RFC 6749 §5.2). Any other failure, such as a server
 * error, rate limiting or a network error, says nothing about the refresh
 * token, and throws a plain error.
 */
export async function requestRefreshedToken (tokenURL: string, clientId: string, refreshToken: string): Promise<RefreshedToken> {
  const xhr = await postRefreshGrant(tokenURL, clientId, refreshToken);
  const response = xhr?.response;
  if (xhr?.status === 200 && typeof response?.access_token === 'string' && response.access_token) {
    log(`[token-refresh] access token good for ${response.expires_in} seconds`);
    const refreshed: RefreshedToken = {
      token: response.access_token,
      tokenType: response.token_type
    };
    // Set only when the server rotates it to a valid value; a null or empty
    // refresh_token must not discard the token we already have.
    if (typeof response.refresh_token === 'string' && response.refresh_token) {
      refreshed.refreshToken = response.refresh_token;
    }
    return refreshed;
  }
  if (response?.error === 'invalid_grant') {
    throw new UnauthorizedError('refresh token rejected: ' + JSON.stringify(response));
  }
  throw new Error(`could not refresh the access token (${xhr?.status}): ${JSON.stringify(response)}`);
}
