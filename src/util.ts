// Reusable utility functions

import Global = NodeJS.Global;

/**
 * Takes an object and its copy as produced by the _deepClone function
 * below, and finds and fixes any ArrayBuffers that were cast to `{}` instead
 * of being cloned to new ArrayBuffers with the same content.
 *
 * It recurses into sub-objects, but skips arrays if they occur.
 */
function _fixArrayBuffers(srcObj: object, dstObj: object) {
  if(typeof (srcObj) !== 'object' || Array.isArray(srcObj) || srcObj === null) {
    return;
  }
  for (const field in srcObj) {
    if(typeof (srcObj[field]) === 'object' && srcObj[field] !== null) {
      if(srcObj[field].toString() === '[object ArrayBuffer]') {
        dstObj[field] = new ArrayBuffer(srcObj[field].byteLength);
        const srcArr = new Int8Array(srcObj[field]);
        const dstArr = new Int8Array(dstObj[field]);
        dstArr.set(srcArr);
      } else {
        _fixArrayBuffers(srcObj[field], dstObj[field]);
      }
    }
  }
}

export const logError = (error: any) => {
  if(typeof (error) === 'string') {
    console.error(error);
  } else {
    console.error(error.message, error.stack);
  }
};

export const globalContext = (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : global));

export const getGlobalContext = (): Window | Global => {
  return (typeof (window) !== 'undefined' ? window : (typeof self === 'object' ? self : global));
};

export const extend = (...args): unknown => {
  const target = args[0];
  const sources = Array.prototype.slice.call(args, 1);
  sources.forEach(function (source) {
    for (const key in source) {
      target[key] = source[key];
    }
  });
  return target;
};

export const containingFolder = (path: string): string => {
  if(path === '') {
    return '/';
  }
  if(!path) {
    throw "Path not given!";
  }

  return path.replace(/\/+/g, '/')
    .replace(/[^\/]+\/?$/, '');
};

export const isFolder = (path: string): boolean => {
  return path.substr(-1) === '/';
};

export const isDocument = (path: string): boolean => {
  return !isFolder(path);
};

export const baseName = (path: string): string => {
  const parts = path.split('/');
  if(isFolder(path)) {
    return parts[parts.length - 2] + '/';
  } else {
    return parts[parts.length - 1];
  }
};

export const cleanPath = (path: string): string => {
  return path.replace(/\/+/g, '/')
    .split('/').map(encodeURIComponent).join('/')
    .replace(/'/g, '%27');
};

export const bindAll = (object: object) => {
  for (const key in this) {
    if(typeof (object[key]) === 'function') {
      object[key] = object[key].bind(object);
    }
  }
};

export const equal = (a: any, b: any, seen = []): boolean => {
  let key;

  if(typeof (a) !== typeof (b)) {
    return false;
  }

  if(typeof (a) === 'number' || typeof (a) === 'boolean' || typeof (a) === 'string') {
    return a === b;
  }

  if(typeof (a) === 'function') {
    return a.toString() === b.toString();
  }

  if(a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
    // Without the following conversion the browsers wouldn't be able to
    // tell the ArrayBuffer instances apart.
    a = new Uint8Array(a);
    b = new Uint8Array(b);
  }

  // If this point has been reached, a and b are either arrays or objects.

  if(a instanceof Array) {
    if(a.length !== b.length) {
      return false;
    }

    for (let i = 0, c = a.length; i < c; i++) {
      if(!equal(a[i], b[i], seen)) {
        return false;
      }
    }
  } else {
    // Check that keys from a exist in b
    for (key in a) {
      if(a.hasOwnProperty(key) && !(key in b)) {
        return false;
      }
    }

    // Check that keys from b exist in a, and compare the values
    for (key in b) {
      if(!b.hasOwnProperty(key)) {
        continue;
      }

      if(!(key in a)) {
        return false;
      }

      let seenArg;

      if(typeof (b[key]) === 'object') {
        if(seen.indexOf(b[key]) >= 0) {
          // Circular reference, don't attempt to compare this object.
          // If nothing else returns false, the objects match.
          continue;
        }

        seenArg = seen.slice();
        seenArg.push(b[key]);
      }

      if(!equal(a[key], b[key], seenArg)) {
        return false;
      }
    }
  }

  return true;
};

export const deepClone = (obj: any): any => {
  if(obj === undefined) {
    return undefined;
  } else {
    const clone = JSON.parse(JSON.stringify(obj));
    _fixArrayBuffers(obj, clone);
    return clone;
  }
};

export const pathsFromRoot = (path: string): string[] => {
  const paths = [path];
  const parts = path.replace(/\/$/, '').split('/');

  while (parts.length > 1) {
    parts.pop();
    paths.push(parts.join('/') + '/');
  }
  return paths;
};

export const localStorageAvailable = (): boolean => {
  const context = getGlobalContext();

  if(!('localStorage' in context)) {
    return false;
  }

  try {
    context.localStorage.setItem('rs-check', '1');
    context.localStorage.removeItem('rs-check');
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Extract and parse JSON data from localStorage.
 *
 * @param {string} key - localStorage key
 *
 * @returns {object} parsed object or undefined
 */
export const getJSONFromLocalStorage = (key: string): object => {
  const context = getGlobalContext() as Window;

  try {
    return JSON.parse(context.localStorage.getItem(key));
  } catch (e) {
    // no JSON stored
  }
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
export const shouldBeTreatedAsBinary = (content: string, mimeType: string): boolean => {
  // eslint-disable-next-line no-control-regex
  return !!((mimeType && mimeType.match(/charset=binary/)) || /[\x00-\x08\x0E-\x1F\uFFFD]/.test(content));
};

/**
 * Read data from an ArrayBuffer and return it as a string
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} encoding
 * @returns {Promise} Resolves with a string containing the data
 */
export const getTextFromArrayBuffer = (arrayBuffer: ArrayBuffer, encoding: string): Promise<string | ArrayBuffer> => {
  return new Promise((resolve/*, reject*/) => {
    if(typeof Blob === 'undefined') {
      const buffer = new Buffer(new Uint8Array(arrayBuffer));
      resolve(buffer.toString(encoding));
    } else {
      let blob;
      const gc = globalContext as any;
      // TODO fix as BlobBuilder is not available in all browsers
      // @see https://developer.mozilla.org/en-US/docs/Web/API/BlobBuilder
      gc.BlobBuilder = gc.BlobBuilder || gc.WebKitBlobBuilder;
      if(typeof gc.BlobBuilder !== 'undefined') {
        const bb = new gc.BlobBuilder();
        bb.append(arrayBuffer);
        blob = bb.getBlob();
      } else {
        blob = new Blob([arrayBuffer]);
      }

      const fileReader = new FileReader();
      if(typeof fileReader.addEventListener === 'function') {
        fileReader.addEventListener('loadend', function (evt) {
          resolve(evt.target.result);
        });
      } else {
        fileReader.onloadend = function (evt) {
          resolve(evt.target.result);
        };
      }
      fileReader.readAsText(blob, encoding);
    }
  });
};


