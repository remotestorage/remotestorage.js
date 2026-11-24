// The PKCE S256 code challenge is base64url(SHA-256(ASCII(codeVerifier))),
// without padding.  While this test util function is very similar to
// generateCodeVerifier(), it does guard against mistakes in generateCodeVerifier().
export async function expectedPKCECodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return Buffer.from(digest).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
