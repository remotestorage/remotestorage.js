/**
 * This file implements an HTTP request with timeout, on top of fetch or XHR.
 * The returned value always looks like an XHR.
 * It is used by authorize.ts, wireclient.ts, googledrive.ts and dropbox.ts.
 * The timeout is set by RemoteStorage#setRequestTimeout(timeout)
 */
/**
 * Extracts a retry interval from header,
 * defaulting to three tries and a pause, within sync interval
 * */
export declare function retryAfterMs(xhr: XMLHttpRequest): number;
export declare let isArrayBufferView: {
    (arg0: unknown): any;
    (object: any): boolean;
    (object: any): boolean;
};
export interface RequestOptions {
    body?: XMLHttpRequestBodyInit;
    headers?: HeadersInit;
    responseType?: XMLHttpRequestResponseType;
}
export declare function requestWithTimeout(method: string, url: string, options: RequestOptions): Promise<XMLHttpRequest>;
//# sourceMappingURL=requests.d.ts.map