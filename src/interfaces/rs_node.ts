export type RSNode = {
  [key: string]: any;
};

export type RSNodes = {
  [key: string]: RSNode;
};

export type ProcessNodes = {
  (nodePaths: string[], nodes: RSNodes): RSNodes;
}
