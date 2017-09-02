/**
 * TODO: document (and maybe move to utils)
 *
 * @private
 */
function deprecate(thing, replacement) {
  console.log('WARNING: ' + thing + ' is deprecated. Use ' +
              replacement + ' instead.');
}

var eventHandling = require('./eventhandling');
var util = require('./util');
var config = require('./config');
var uuid = require('uuid/v4');

/**
 * Provides a high-level interface to access data below a given root path.
 */
var BaseClient = function (storage, base) {
  if (base[base.length - 1] !== '/') {
    throw "Not a folder: " + base;
  }

  if (base === '/') {
    // allow absolute and relative paths for the root scope.
    this.makePath = function (path) {
      return (path[0] === '/' ? '' : '/') + path;
    };
  }

  /**
   * The <RemoteStorage> instance this <BaseClient> operates on.
   */
  this.storage = storage;

  /**
   * Base path, which this <BaseClient> operates on.
   *
   * For the module's privateClient this would be /<moduleName>/, for the
   * corresponding publicClient /public/<moduleName>/.
   */
  this.base = base;

  /**
   * TODO: document
   */
  var parts = this.base.split('/');
  if (parts.length > 2) {
    this.moduleName = parts[1];
  } else {
    this.moduleName = 'root';
  }

  /**
   * Event: change
   *
   * Emitted when a node changes
   *
   * Arguments:
   *   event - Event object containing information about the changed node
   *
   * (start code)
   * {
   *    path: path, // Absolute path of the changed node, from the storage root
   *    relativePath: relativePath, // Path of the changed node, relative to this baseclient's scope root
   *    origin: 'window', 'local', 'remote', or 'conflict' // emitted by user action within the app, local data store, remote sync, or versioning conflicts
   *    oldValue: oldBody, // Old body of the changed node (local version in conflicts; undefined if creation)
   *    newValue: newBody, // New body of the changed node (remote version in conflicts; undefined if deletion)
   *    lastCommonValue: lastCommonValue, //most recent known common ancestor body of 'yours' and 'theirs' in case of conflict
   *    oldContentType: oldContentType, // Old contentType of the changed node ('yours' for conflicts; undefined if creation)
   *    newContentType: newContentType, // New contentType of the changed node ('theirs' for conflicts; undefined if deletion)
   *    lastCommonContentType: lastCommonContentType // Most recent known common ancestor contentType of 'yours' and 'theirs' in case of conflict
   *  }
   * (end code)
   *
   * Example of an event with origin 'local' (fired on page load):
   *
   * (start code)
   * {
   *    path: '/public/design/color.txt',
   *    relativePath: 'color.txt',
   *    origin: 'local',
   *    oldValue: undefined,
   *    newValue: 'white',
   *    oldContentType: undefined,
   *    newContentType: 'text/plain'
   *  }
   * (end code)
   *
   * Example of a conflict:
   * Say you changed 'color.txt' from 'white' to 'blue'; if you have set `config.changeEvents.window` to `true`,
   * then you will receive:
   *
   * (start code)
   * {
   *    path: '/public/design/color.txt',
   *    relativePath: 'color.txt',
   *    origin: 'window',
   *    oldValue: 'white',
   *    newValue: 'blue',
   *    oldContentType: 'text/plain',
   *    newContentType: 'text/plain'
   *  }
   * (end code)
   *
   * But when this change is pushed out by asynchronous synchronization, this change may rejected by the
   * server, if the remote version has in the meantime changed from 'white' to  for instance 'red'; this will then lead to a change
   * event with origin 'conflict' (usually a few seconds after the event with origin 'window', if you had that activated). Note
   * that since you already changed it from 'white' to 'blue' in the local version a few seconds ago, `oldValue` is now your local
   * value of 'blue':
   *
   * (start code)
   * {
   *    path: '/public/design/color.txt',
   *    relativePath: 'color.txt',
   *    origin: 'conflict',
   *    oldValue: 'blue',
   *    newValue: 'red',
   *    lastCommonValue: 'white',
   *    oldContentType: 'text/plain,
   *    newContentType: 'text/plain'
   *    lastCommonContentType: 'text/plain'
   *  }
   * (end code)
   *
   * In practice, you should always redraw your views to display the content of the `newValue` field when a change event is received,
   * regardless of its origin. Events with origin 'local' are fired conveniently during the page load, so that you can fill your views
   * when the page loads. Events with origin 'window' are fired whenever you change a value by calling a method on the baseClient;
   * these are disabled by default. Events with origin 'remote' are fired when remote changes are discovered during sync (only for caching
   * startegies 'SEEN' and 'ALL'). Events with origin 'conflict' are fired when a conflict occurs while pushing out your local changes to
   * the remote store in asynchronous synchronization (see example above).
   **/

  eventHandling(this, 'change');
  this.on = this.on.bind(this);
  storage.onChange(this.base, this._fireChange.bind(this));
};

BaseClient.prototype = {

  extend: function (object) {
    for (var key in object) {
      this[key] = object[key];
    }
    return this;
  },

  /**
   * Instantiate a new client, scoped to a subpath of the current client's
   * path.
   *
   * @returns {BaseClient} A new client operating on a subpath of the current
   *                       base path.
   */
  scope: function (path) {
    return new BaseClient(this.storage, this.makePath(path));
  },

  /**
   * Get a list of child nodes below a given path.
   *
   * @param {string} path - The path to query. It MUST end with a forward slash.
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached listing in milliseconds. See :ref:`max-age`.
   *
   * @returns A promise for an object representing child nodes
   */
  getListing: function (path, maxAge) {
    if (typeof(path) !== 'string') {
      path = '';
    } else if (path.length > 0 && path[path.length - 1] !== '/') {
      return Promise.reject("Not a folder: " + path);
    }
    return this.storage.get(this.makePath(path), maxAge).then(
      function (r) {
        return (r.statusCode === 404) ? {} : r.body;
      }
    );
  },

  /**
   * Get all objects directly below a given path.
   *
   * @param {string} path - Path to the folder. Must end in a forward slash.
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached objects in milliseconds. See :ref:`max-age`.
   *
   * @returns A promise for an object
   */
  getAll: function (path, maxAge) {
    if (typeof(path) !== 'string') {
      path = '';
    } else if (path.length > 0 && path[path.length - 1] !== '/') {
      return Promise.reject("Not a folder: " + path);
    }

    return this.storage.get(this.makePath(path), maxAge).then(function (r) {
      if (r.statusCode === 404) { return {}; }
      if (typeof(r.body) === 'object') {
        var keys = Object.keys(r.body);
        if (keys.length === 0) {
          // treat this like 404. it probably means a folder listing that
          // has changes that haven't been pushed out yet.
          return {};
        }

        var calls = keys.map(function (key) {
          return this.storage.get(this.makePath(path + key), maxAge)
            .then(function (o) {
              if (typeof(o.body) === 'string') {
                try {
                  o.body = JSON.parse(o.body);
                } catch (e) {
                }
              }
              if (typeof(o.body) === 'object') {
                r.body[key] = o.body;
              }
            });
        }.bind(this));
        return Promise.all(calls).then(function () {
          return r.body;
        });
      }
    }.bind(this));
  },

  /**
   * Get the file at the given path. A file is raw data, as opposed to
   * a JSON object (use :func:`getObject` for that).
   *
   * @param {string} path - Relative path from the module root (without leading
   *                        slash).
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          the cached file in milliseconds. See :ref:`max-age`.
   *
   * @returns A promise for an object
   */
  getFile: function (path, maxAge) {
    if (typeof(path) !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
    }
    return this.storage.get(this.makePath(path), maxAge).then(function (r) {
      return {
        data: r.body,
        contentType: r.contentType,
        revision: r.revision // (this is new)
      };
    });
  },

  /**
   * storeFile
   *
   * Store raw data at a given path.
   *
   * Parameters:
   *   mimeType - MIME media type of the data being stored
   *   path     - path relative to the module root. MAY NOT end in a forward slash.
   *   data     - string, ArrayBuffer or ArrayBufferView of raw data to store
   *
   * The given mimeType will later be returned, when retrieving the data
   * using <getFile>.
   *
   * Example (UTF-8 data):
   *   (start code)
   *   client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>');
   *   (end code)
   *
   * Example (Binary data):
   *   (start code)
   *   // MARKUP:
   *   <input type="file" id="file-input">
   *   // CODE:
   *   var input = document.getElementById('file-input');
   *   var file = input.files[0];
   *   var fileReader = new FileReader();
   *
   *   fileReader.onload = function () {
   *     client.storeFile(file.type, file.name, fileReader.result);
   *   };
   *
   *   fileReader.readAsArrayBuffer(file);
   *   (end code)
   */
  storeFile: function (mimeType, path, body) {
    if (typeof(mimeType) !== 'string') {
      return Promise.reject('Argument \'mimeType\' of baseClient.storeFile must be a string');
    }
    if (typeof(path) !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
    }
    if (typeof(body) !== 'string' && typeof(body) !== 'object') {
      return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
    }
    if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
      console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
    }

    return this.storage.put(this.makePath(path), body, mimeType).then(function (r) {
      if (r.statusCode === 200 || r.statusCode === 201) {
        return r.revision;
      } else {
        return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
      }
    }.bind(this));
  },

  /**
   * Get a JSON object from the given path.
   *
   * @param {string} path - Relative path from the module root (without leading
   *                        slash).
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached object in milliseconds. See :ref:`max-age`.
   *
   * @returns A promise, which resolves with the requested object (or ``null``
   *          if non-existent)
   */
  getObject: function (path, maxAge) {
    if (typeof(path) !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
    }
    return this.storage.get(this.makePath(path), maxAge).then(function (r) {
      if (typeof(r.body) === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
        return r.body;
      } else if (typeof(r.body) === 'string') {
        try {
          return JSON.parse(r.body);
        } catch (e) {
          throw "Not valid JSON: " + this.makePath(path);
        }
      } else if (typeof(r.body) !== 'undefined' && r.statusCode === 200) {
        return Promise.reject("Not an object: " + this.makePath(path));
      }
    }.bind(this));
  },

  /**
   * Method: storeObject
   *
   * Store object at given path. Triggers synchronization.
   *
   * Parameters:
   *
   *   type     - unique type of this object within this module. See description below.
   *   path     - path relative to the module root.
   *   object   - an object to be saved to the given node. It must be serializable as JSON.
   *
   * Returns:
   *   A promise to store the object. The promise fails with a ValidationError, when validations fail.
   *
   *
   * What about the type?:
   *
   *   A great thing about having data on the web, is to be able to link to
   *   it and rearrange it to fit the current circumstances. To facilitate
   *   that, eventually you need to know how the data at hand is structured.
   *   For documents on the web, this is usually done via a MIME type. The
   *   MIME type of JSON objects however, is always application/json.
   *   To add that extra layer of "knowing what this object is", remoteStorage
   *   aims to use <JSON-LD at http://json-ld.org/>.
   *   A first step in that direction, is to add a *@context attribute* to all
   *   JSON data put into remoteStorage.
   *   Now that is what the *type* is for.
   *
   *   Within remoteStorage.js, @context values are built using three components:
   *     http://remotestorage.io/spec/modules/ - A prefix to guarantee uniqueness
   *     the module name     - module names should be unique as well
   *     the type given here - naming this particular kind of object within this module
   *
   *   In retrospect that means, that whenever you introduce a new "type" in calls to
   *   storeObject, you should make sure that once your code is in the wild, future
   *   versions of the code are compatible with the same JSON structure.
   *
   * How to define types?:
   *
   *   See <declareType> for examples.
   */
  storeObject: function (typeAlias, path, object) {
    if (typeof(typeAlias) !== 'string') {
      return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
    }
    if (typeof(path) !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
    }
    if (typeof(object) !== 'object') {
      return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
    }

    this._attachType(object, typeAlias);

    try {
      var validationResult = this.validate(object);
      if (! validationResult.valid) {
        return Promise.reject(validationResult);
      }
    } catch(exc) {
      return Promise.reject(exc);
    }

    return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then(function (r) {
      if (r.statusCode === 200 || r.statusCode === 201) {
        return r.revision;
      } else {
        return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
      }
    }.bind(this));
  },

  /**
   * remove
   *
   * Remove node at given path from storage. Triggers synchronization.
   *
   * @param {string} path - Path relative to the module root.
   * @returns TODO
   */
  remove: function (path) {
    if (typeof(path) !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
    }
    if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
      console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
    }

    return this.storage.delete(this.makePath(path));
  },

  /**
   * TODO: document
   */
  cache: function (path, strategy) {
    if (typeof(path) !== 'string') {
      throw 'Argument \'path\' of baseClient.cache must be a string';
    }
    if (strategy === false) {
      deprecate('caching strategy <false>', '<"FLUSH">');
      strategy = 'FLUSH';
    } else if (strategy === undefined) {
      strategy = 'ALL';
    } else if (typeof(strategy) !== 'string') {
      deprecate('that caching strategy', '<"ALL">');
      strategy = 'ALL';
    }
    if (strategy !== 'FLUSH' &&
        strategy !== 'SEEN' &&
        strategy !== 'ALL') {
      throw 'Argument \'strategy\' of baseclient.cache must be one of '
          + '["FLUSH", "SEEN", "ALL"]';
    }
    this.storage.caching.set(this.makePath(path), strategy);
    return this;
  },

  /**
   * TODO: document
   *
   * @private
   */
  flush: function (path) {
    return this.storage.local.flush(path);
  },

  /**
   * TODO: document
   *
   * @private
   */
  makePath: function (path) {
    return this.base + (path || '');
  },

  /**
   * TODO: document
   *
   * @private
   */
  _fireChange: function (event) {
    if (config.changeEvents[event.origin]) {
      ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
        if ((!event[fieldNamePrefix+'ContentType'])
            || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix+'ContentType']))) {
          if (typeof(event[fieldNamePrefix+'Value']) === 'string') {
            try {
              event[fieldNamePrefix+'Value'] = JSON.parse(event[fieldNamePrefix+'Value']);
            } catch(e) {
            }
          }
        }
      });
      this._emit('change', event);
    }
  },

  /**
   * TODO: document
   *
   * @private
   */
  _cleanPath: util.cleanPath,

  /**
   * getItemURL
   *
   * Retrieve full URL of item
   *
   * @param {string} path - Path relative to the module root.
   */
  getItemURL: function (path) {
    if (typeof(path) !== 'string') {
      throw 'Argument \'path\' of baseClient.getItemURL must be a string';
    }
    if (this.storage.connected) {
      path = this._cleanPath( this.makePath(path) );
      return this.storage.remote.href + path;
    } else {
      return undefined;
    }
  },

  uuid: function () {
    return uuid();
  }
};

BaseClient._rs_init = function () {};

module.exports = BaseClient;

// needs to be after the export to change prototype
// this should be different (we need to import `types` functionality, not
// modifing BaseClient.prototype from there)
require('./types');
