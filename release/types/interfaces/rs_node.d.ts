export type RSItem = {
    body?: string | object | false;
    contentType?: string;
    contentLength?: number;
    revision?: string;
    timestamp?: number;
    itemsMap?: {
        [key: string]: any;
    };
    previousBody?: string | object | false;
    previousContentType?: string;
};
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
};
//# sourceMappingURL=rs_node.d.ts.map