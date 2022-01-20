export type StorageInfo = {
  href: string;
  storageApi: string; // TODO define allowed strings,
  authURL: string;
  properties: object; // TODO define Webfinger link properties
  userAddress?: string;
};
