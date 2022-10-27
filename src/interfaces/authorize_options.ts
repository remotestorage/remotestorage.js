
export interface AuthorizeOptions {
  authURL: string;
  scope?: string;
  redirectUri?: string;
  clientId?: string;
  response_type?: 'token' | 'code';
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain';
  token_access_type?: 'online' | 'offline';   // Dropbox only
}
