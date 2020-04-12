declare interface StorageInfo {
  href: string;
  storageApi: string; // TODO define allowed strings,
  authUrl: string;
  properties: object; // TODO define Webfinger link properties
}
