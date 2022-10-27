/**
 * This file implements an HTTP request with timeout, on top of fetch or XHR.
 * The returned value always looks like an XHR.
 * It is used by authorize.ts, wireclient.ts, googledrive.ts and dropbox.ts.
 * The timeout is set by RemoteStorage#setRequestTimeout(timeout)
 */

import log from "./log";
import config from "./config";


/**
 * Extracts a retry interval from header,
 * defaulting to three tries and a pause, within sync interval
 * */
export function retryAfterMs(xhr: XMLHttpRequest): number {
  const serverMs = parseInt(xhr.getResponseHeader('Retry-After')) * 1000;
  if (serverMs >= 1000) {   // sanity check
    return serverMs;
  } else {   // value is NaN if no such header, or malformed
    // three tries and a pause, within sync interval,
    // with lower & upper bounds
    return Math.max(1500, Math.min(60_000, Math.round(config.syncInterval / (2.9 + Math.random() * 0.2))));
  }
}

export let isArrayBufferView: { (arg0: unknown): any; (object: any): boolean; (object: any): boolean };

if (typeof ((global || window as any).ArrayBufferView) === 'function') {
  isArrayBufferView = function (object) {
    return object && (object instanceof (global || window as any).ArrayBufferView);
  };
} else {
  const arrayBufferViews = [
    Int8Array, Uint8Array, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array
  ];
  isArrayBufferView = function (object): boolean {
    for (let i = 0; i < 8; i++) {
      if (object instanceof arrayBufferViews[i]) {
        return true;
      }
    }
    return false;
  };
}


export interface RequestOptions {
  body?: XMLHttpRequestBodyInit;
  headers?: HeadersInit;
  responseType?: XMLHttpRequestResponseType;
}

export async function requestWithTimeout(method: string, url: string, options: RequestOptions): Promise<XMLHttpRequest> {
  if (typeof fetch === 'function') {
    return _fetchRequestWithTimeout(method, url, options);
  } else if (typeof XMLHttpRequest === 'function') {
    return _xhrRequestWithTimeout(method, url, options);
  } else {
    return Promise.reject('[Requests] You need to add a polyfill for fetch or XMLHttpRequest');
  }
}

async function _fetchRequestWithTimeout(method: string, url: string, options: RequestOptions): Promise<XMLHttpRequest> {
  const abortController = typeof AbortController === 'function' ?
    new AbortController() :
    null;
  let timeoutId;

  const timeoutPromise: Promise<never> = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (abortController) {
        abortController.abort();
      }
      reject('timeout');
    }, config.requestTimeout);
  });

  let syntheticXhr;
  const responseHeaders = {};

  const networkPromise: Promise<XMLHttpRequest> = fetch(url, {
    method: method,
    headers: options.headers,
    body: options.body,
    signal: abortController ? abortController.signal : undefined
  }).then((response) => {
    log('[requests fetch]', response);

    response.headers.forEach((value: string, headerName: string) => {
      responseHeaders[headerName.toUpperCase()] = value;
    });

    syntheticXhr = {
      readyState: 4,
      status: response.status,
      statusText: response.statusText,
      response: undefined,
      getResponseHeader: (headerName: string): string => {
        return responseHeaders[headerName.toUpperCase()] || null;
      },
      // responseText: 'foo',
      responseType: options.responseType,
      responseURL: url,
    };
    switch (options.responseType) {
      case 'arraybuffer':
        return response.arrayBuffer();
      case 'blob':
        return response.blob();
      case 'json':
        return response.json();
      case undefined:
      case '':
      case 'text':
        return response.text();
      default:   // document
        throw new Error("responseType 'document' is not currently supported using fetch");
    }
  }).then((processedBody) => {
    syntheticXhr.response = processedBody;
    if (!options.responseType || options.responseType === 'text') {
      syntheticXhr.responseText = processedBody;
    }
    return syntheticXhr;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  return Promise.race([networkPromise, timeoutPromise]);
}

async function _xhrRequestWithTimeout(method: string, url: string, options: RequestOptions): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {

    log('[requests XHR]', method, url);

    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      reject('timeout');
    }, config.requestTimeout);

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (options.responseType) {
      xhr.responseType = options.responseType;
    }

    if (options.headers) {
      for (const key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    xhr.onload = (): void => {
      if (timedOut) {
        return;
      }
      clearTimeout(timer);
      resolve(xhr);
    };

    xhr.onerror = (error): void => {
      if (timedOut) {
        return;
      }
      clearTimeout(timer);
      reject(error);
    };

    let body = options.body;

    if (typeof (body) === 'object' && !isArrayBufferView(body) && body instanceof ArrayBuffer) {
      body = new Uint8Array(body);
    }
    xhr.send(body);
  });
}
