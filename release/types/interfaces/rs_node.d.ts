export declare type RSItem = {
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
export declare type RSNode = {
    path: string;
    common?: RSItem;
    local?: RSItem;
    remote?: RSItem;
    push?: RSItem;
};
export declare type RSNodes = {
    [key: string]: RSNode;
};
export declare type ProcessNodes = {
    (nodePaths: string[], nodes: RSNodes): RSNodes;
};
//# sourceMappingURL=rs_node.d.ts.map