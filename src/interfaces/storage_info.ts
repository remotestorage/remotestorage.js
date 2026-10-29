export type StorageInfo = {
  href: string;
  storageApi: string; // TODO define allowed strings,
  authURL: string;
  properties: object; // TODO define Webfinger link properties
  userAddress?: string;
  /** PKCE token endpoint (spec §10.1, rfc6749#section-3.2), when advertised. */
  tokenURL?: string;
  /** Authorization endpoint (spec §10.1, rfc6749#section-3.1), when advertised. */
  authorizationURL?: string;
  /**
   * PKCE code_challenge methods (spec §10.1, rfc7636), e.g. "S256". The spec
   * says a string; an array is tolerated too.
   */
  pkceMethods?: string | string[];
};
