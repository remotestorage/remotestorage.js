/**
 * Class: RemoteStorage.Util
 *
 * Provides reusable utility functions at RemoteStorage.util
 *
 */
(function() {

  /**
   * Function: fixArrayBuffers
   *
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

  RemoteStorage.util = {
    getEventEmitter: function() {
      var object = {};
      var args = Array.prototype.slice.call(arguments);
      args.unshift(object);
      RemoteStorage.eventHandling.apply(RemoteStorage, args);
      object.emit = object._emit;
      return object;
    },

    extend: function(target) {
      var sources = Array.prototype.slice.call(arguments, 1);
      sources.forEach(function(source) {
        for (var key in source) {
          target[key] = source[key];
        }
      });
      return target;
    },

    asyncEach: function(array, callback) {
      return this.asyncMap(array, callback).
        then(function() { return array; });
    },

    asyncMap: function(array, callback) {
      var promise = promising();
      var n = array.length, i = 0;
      var results = [], errors = [];
      function oneDone() {
        i++;
        if (i === n) {
          promise.fulfill(results, errors);
        }
      }

      array.forEach(function(item, index) {
        var result;
        try {
          result = callback(item);
        } catch(exc) {
          oneDone();
          errors[index] = exc;
        }
        if (typeof(result) === 'object' && typeof(result.then) === 'function') {
          result.then(function(res) { results[index] = res; oneDone(); },
                      function(error) { errors[index] = error; oneDone(); });
        } else {
          oneDone();
          results[index] = result;
        }
      });

      return promise;
    },

    containingFolder: function(path) {
      if (path === '') {
        return '/';
      }
      if (! path) {
        throw "Path not given!";
      }

      return path.replace(/\/+/g, '/').replace(/[^\/]+\/?$/, '');
    },

    isFolder: function(path) {
      return path.substr(-1) === '/';
    },

    isDocument: function(path) {
      return path.substr(-1) !== '/';
    },

    baseName: function(path) {
      var parts = path.split('/');
      if (this.isFolder(path)) {
        return parts[parts.length-2]+'/';
      } else {
        return parts[parts.length-1];
      }
    },

    bindAll: function(object) {
      for (var key in this) {
        if (typeof(object[key]) === 'function') {
          object[key] = object[key].bind(object);
        }
      }
    },

    equal: function(obj1, obj2) {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    },

    equalObj: function(x, y) {
      var p;
      for (p in y) {
        if (typeof(x[p]) === 'undefined') {return false;}
      }
      for (p in y) {
        if (y[p]) {
          switch (typeof(y[p])) {
            case 'object':
              if (!y[p].equals(x[p])) { return false; }
              break;
            case 'function':
              if (typeof(x[p])==='undefined' ||
                  (p !== 'equals' && y[p].toString() !== x[p].toString())) {
                return false;
              }
              break;
            default:
              if (y[p] !== x[p]) { return false; }
          }
        } else {
          if (x[p]) { return false; }
        }
      }
      for (p in x) {
        if(typeof(y[p]) === 'undefined') {
          return false;
        }
      }
      return true;
    },

    deepClone: function(obj) {
      var clone;
      if (obj === undefined) {
        return undefined;
      } else {
        clone = JSON.parse(JSON.stringify(obj));
        fixArrayBuffers(obj, clone);
        return clone;
      }
    },

    pathsFromRoot: function(path) {
      var paths = [path];
      var parts = path.replace(/\/$/, '').split('/');

      while (parts.length > 1) {
        parts.pop();
        paths.push(parts.join('/')+'/');
      }
      return paths;
    }

  };

  if (!RemoteStorage.prototype.util) {
    Object.defineProperty(RemoteStorage.prototype, 'util', {
      get: function() {
        console.log('DEPRECATION WARNING: remoteStorage.util was moved to RemoteStorage.util');
        return RemoteStorage.util;
      }
    });
  }
})();
