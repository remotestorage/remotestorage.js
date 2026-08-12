export declare const logError: (error: string | Error) => void;
export declare const globalContext: typeof globalThis;
export declare const getGlobalContext: () => any;
export declare const extend: (...args: any[]) => unknown;
export declare const containingFolder: (path: string) => string;
export declare const isFolder: (path: string) => boolean;
export declare const isDocument: (path: string) => boolean;
export declare const baseName: (path: string) => string;
export declare const cleanPath: (path: string) => string;
export declare const bindAll: (object: object) => void;
export declare const equal: (a: any, b: any, seen?: any[]) => boolean;
export declare const deepClone: (obj: any) => any;
export declare const pathsFromRoot: (path: string) => string[];
export declare const localStorageAvailable: () => boolean;
/**
 * Extract and parse JSON data from localStorage.
 *
 * @param {string} key - localStorage key
 *
 * @returns {object} parsed object or undefined
 */
export declare const getJSONFromLocalStorage: (key: string) => {
    [key: string]: any;
};
/**
 * Decide if data should be treated as binary based on the content (presence of non-printable characters
 * or replacement character) and content-type.
 *
 * @param {string} content - The data
 * @param {string} mimeType - The data's content-type
 *
 * @returns {boolean}
 */
export declare const shouldBeTreatedAsBinary: (content: string | ArrayBuffer, mimeType: string) => boolean;
/**
 * Strip the legacy `; charset=binary` parameter from a Content-Type.
 *
 * Releases <=2.0.0-beta.9 appended this non-standard parameter to all binary
 * PUTs, so files written back then still carry it in their stored Content-Type
 * forever. We sanitize on read so callers never see it: some browsers refuse
 * to render an `<img>` whose Blob type carries the suffix.
 *
 * Only the `charset=binary` parameter is removed; legitimate parameters like
 * `charset=UTF-8` on `text/html` are preserved.
 *
 * @param {string} mimeType - The raw Content-Type as returned by the server.
 * @returns {string} The Content-Type with any `; charset=binary` removed.
 */
export declare const stripLegacyCharsetBinary: (mimeType: string | null) => string | null;
/**
 * Read data from an ArrayBuffer and return it as a string
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} encoding
 * @returns {Promise} Resolves with a string containing the data
 */
export declare const getTextFromArrayBuffer: (arrayBuffer: ArrayBuffer, encoding: any) => Promise<string | ArrayBuffer>;
/**
 * Encode string in base64
 * @param {String} str
 * @returns {String} base64-encoded string
 */
export declare const toBase64: (str: string) => string;
/**
 * Generates values required for OAuth2 PKCE in a cryptographically secure manner.
 * @param {number} [numChar=128] - length of codeVerifier to generate; from 43 to 128
 *
 * @typedef {Object} PkceValues
 * @property {string} codeVerifier - 43 to 128 chars from the 66-char set
 * @property {string} codeChallenge - verifier hashed & base-64 URL encoded
 * @property {string} state - a separate random value. Should be used to check redirect_uri.
 * @returns PkceValues
 */
export declare function generateCodeVerifier(numChar?: number): Promise<{
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}>;
export declare function applyMixins(derivedCtor: any, constructors: any[]): void;
//# sourceMappingURL=util.d.ts.map