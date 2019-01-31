// Reusable utility functions

/**
 * Takes an object and its copy as produced by the _deepClone function
 * below, and finds and fixes any ArrayBuffers that were cast to `{}` instead
 * of being cloned to new ArrayBuffers with the same content.
 *
 * It recurses into sub-objects, but skips arrays if they occur.
 */
function fixArrayBuffers(srcObj, dstObj) {
  var field, srcArr, dstArr;
  if (typeof(srcObj) !== 'object' || Array.isArray(srcObj) || srcObj === null) {
    return;
  }
  for (field in srcObj) {
    if (typeof(srcObj[field]) === 'object' && srcObj[field] !== null) {
      if (srcObj[field].toString() === '[object ArrayBuffer]') {
        dstObj[field] = new ArrayBuffer(srcObj[field].byteLength);
        srcArr = new Int8Array(srcObj[field]);
        dstArr = new Int8Array(dstObj[field]);
        dstArr.set(srcArr);
      } else {
        fixArrayBuffers(srcObj[field], dstObj[field]);
      }
    }
  }
}

var util = {
  logError(error) {
    if (typeof(error) === 'string') {
      console.error(error);
    } else {
      console.error(error.message, error.stack);
    }
  },

  globalContext: (typeof(window) !== 'undefined' ? window : (typeof self === 'object' ? self : global)),

  getGlobalContext () {
    return (typeof(window) !== 'undefined' ? window : (typeof self === 'object' ? self : global));
  },

  extend (target) {
    var sources = Array.prototype.slice.call(arguments, 1);
    sources.forEach(function (source) {
      for (var key in source) {
        target[key] = source[key];
      }
    });
    return target;
  },

  containingFolder (path) {
    if (path === '') {
      return '/';
    }
    if (! path) {
      throw "Path not given!";
    }

    return path.replace(/\/+/g, '/')
               .replace(/[^\/]+\/?$/, '');
  },

  isFolder (path) {
    return path.substr(-1) === '/';
  },

  isDocument (path) {
    return !util.isFolder(path);
  },

  baseName (path) {
    var parts = path.split('/');
    if (util.isFolder(path)) {
      return parts[parts.length-2]+'/';
    } else {
      return parts[parts.length-1];
    }
  },

  cleanPath (path) {
    return path.replace(/\/+/g, '/')
               .split('/').map(encodeURIComponent).join('/')
               .replace(/'/g, '%27');
  },

  bindAll (object) {
    for (var key in this) {
      if (typeof(object[key]) === 'function') {
        object[key] = object[key].bind(object);
      }
    }
  },

  equal (a, b, seen) {
    var key;
    seen = seen || [];

    if (typeof(a) !== typeof(b)) {
      return false;
    }

    if (typeof(a) === 'number' || typeof(a) === 'boolean' || typeof(a) === 'string') {
      return a === b;
    }

    if (typeof(a) === 'function') {
      return a.toString() === b.toString();
    }

    if (a instanceof ArrayBuffer && b instanceof ArrayBuffer) {
      // Without the following conversion the browsers wouldn't be able to
      // tell the ArrayBuffer instances apart.
      a = new Uint8Array(a);
      b = new Uint8Array(b);
    }

    // If this point has been reached, a and b are either arrays or objects.

    if (a instanceof Array) {
      if (a.length !== b.length) {
        return false;
      }

      for (var i = 0, c = a.length; i < c; i++) {
        if (!util.equal(a[i], b[i], seen)) {
          return false;
        }
      }
    } else {
      // Check that keys from a exist in b
      for (key in a) {
        if (a.hasOwnProperty(key) && !(key in b)) {
          return false;
        }
      }

      // Check that keys from b exist in a, and compare the values
      for (key in b) {
        if (!b.hasOwnProperty(key)) {
          continue;
        }

        if (!(key in a)) {
          return false;
        }

        var seenArg;

        if (typeof(b[key]) === 'object') {
          if (seen.indexOf(b[key]) >= 0) {
            // Circular reference, don't attempt to compare this object.
            // If nothing else returns false, the objects match.
            continue;
          }

          seenArg = seen.slice();
          seenArg.push(b[key]);
        }

        if (!util.equal(a[key], b[key], seenArg)) {
          return false;
        }
      }
    }

    return true;
  },

  deepClone (obj) {
    var clone;
    if (obj === undefined) {
      return undefined;
    } else {
      clone = JSON.parse(JSON.stringify(obj));
      fixArrayBuffers(obj, clone);
      return clone;
    }
  },

  pathsFromRoot (path) {
    var paths = [path];
    var parts = path.replace(/\/$/, '').split('/');

    while (parts.length > 1) {
      parts.pop();
      paths.push(parts.join('/')+'/');
    }
    return paths;
  },

  localStorageAvailable () {
    const context = util.getGlobalContext();

    if (!('localStorage' in context)) { return false; }

    try {
      context.localStorage.setItem('rs-check', 1);
      context.localStorage.removeItem('rs-check');
      return true;
    } catch(error) {
      return false;
    }
  },

  /**
   * Extract and parse JSON data from localStorage.
   *
   * @param {string} key - localStorage key
   *
   * @returns {object} parsed object or undefined
   */
  getJSONFromLocalStorage (key) {
    const context = util.getGlobalContext();

    try {
      return JSON.parse(context.localStorage.getItem(key));
    } catch(e) {
      // no JSON stored
    }
  },

  /**
   * Decide if data should be treated as binary based on the content (presence of non-printable characters
   * or replacement character) and content-type.
   *
   * @param {string} content - The data
   * @param {string} mimeType - The data's content-type
   *
   * @returns {boolean}
   */
  shouldBeTreatedAsBinary (content, mimeType) {
    // eslint-disable-next-line no-control-regex
    return (mimeType && mimeType.match(/charset=binary/)) || /[\x00-\x08\x0E-\x1F\uFFFD]/.test(content);
  },

  /**
   * Read data from an ArrayBuffer and return it as a string
   * @param {ArrayBuffer} arrayBuffer 
   * @param {string} encoding 
   * @returns {Promise} Resolves with a string containing the data
   */
  getTextFromArrayBuffer(arrayBuffer, encoding) {
    return new Promise((resolve/*, reject*/) => {
      if (typeof Blob === 'undefined') {
        var buffer = new Buffer(new Uint8Array(arrayBuffer));
        resolve(buffer.toString(encoding));
      } else {
        var blob;
        util.globalContext.BlobBuilder = util.globalContext.BlobBuilder || util.globalContext.WebKitBlobBuilder;
        if (typeof util.globalContext.BlobBuilder !== 'undefined') {
          var bb = new global.BlobBuilder();
          bb.append(arrayBuffer);
          blob = bb.getBlob();
        } else {
          blob = new Blob([arrayBuffer]);
        }
  
        var fileReader = new FileReader();
        if (typeof fileReader.addEventListener === 'function') {
          fileReader.addEventListener('loadend', function (evt) {
            resolve(evt.target.result);
          });
        } else {
          fileReader.onloadend = function(evt) {
            resolve(evt.target.result);
          };
        }
        fileReader.readAsText(blob, encoding);
      }
    });
  }
  

};

module.exports = util;
