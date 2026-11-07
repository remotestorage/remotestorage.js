/**
 * Metadata for one child of a folder, as returned by the remote server's
 * folder description. Mirrors the raw key names used on the wire.
 */
export type ItemMeta = {
  ETag: string;
  "Content-Type"?: string;
  "Content-Length"?: number;
  "Last-Modified"?: string;
}

export type RSItem = {
  body?: string | object | ArrayBuffer | ArrayBufferView | false;
  contentType?: string;
  contentLength?: number;
  revision?: string;
  timestamp?: number;
  itemsMap?: { [key: string]: any; };
  /**
   * Per-child metadata for folder items, parallel to `itemsMap`. Populated
   * from the server's folder description so that cached listings can include
   * the same metadata as uncached ones. Not present in caches written before
   * this field was introduced, and absent for locally created children.
   */
  itemsMeta?: { [key: string]: ItemMeta };
  previousBody?: string | object | ArrayBuffer | ArrayBufferView | false;
  previousContentType?: string;
}

export type RSNode = {
  path: string;
  common?: RSItem;
  local?: RSItem;
  remote?: RSItem;
  push?: RSItem;
};

export type RSNodes = {
  [key: string]: RSNode;
};

export type ProcessNodes = {
  (nodePaths: string[], nodes: RSNodes): RSNodes;
}
