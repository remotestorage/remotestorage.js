import tv4 from 'tv4';
import type { JsonSchemas } from './interfaces/json_schema';
import type { ChangeObj } from './interfaces/change_obj';
import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import Types from './types';
import SchemaNotFound from './schema-not-found-error';
import EventHandling from './eventhandling';
import config from './config';
import { applyMixins, cleanPath, isFolder } from './util';
import RemoteStorage from './remotestorage';

function getModuleNameFromBase(path: string): string {
  const parts = path.split('/');
  return path.length > 2 ? parts[1] : 'root';
}

/**
 * Provides a high-level interface to access data below a given root path.
 */
class BaseClient {
  /**
   * The <RemoteStorage> instance this <BaseClient> operates on.
   */
  storage: RemoteStorage;

  /**
   * Base path, which this <BaseClient> operates on.
   *
   * For the module's privateClient this would be /<moduleName>/, for the
   * corresponding publicClient /public/<moduleName>/.
   */
  base: string;

  moduleName: string;

  constructor(storage: RemoteStorage, base: string) {
    if (base[base.length - 1] !== '/') {
      throw "Not a folder: " + base;
    }

    if (base === '/') {
      // allow absolute and relative paths for the root scope.
      this.makePath = (path: string): string => {
        return (path[0] === '/' ? '' : '/') + path;
      };
    }

    this.storage = storage;
    this.base = base;
    this.moduleName = getModuleNameFromBase(this.base);

    this.addEvents(['change']);
    this.on = this.on.bind(this);
    storage.onChange(this.base, this._fireChange.bind(this));
  }

  /**
   * Instantiate a new client, scoped to a subpath of the current client's
   * path.
   *
   * @param path - The path to scope the new client to
   *
   * @returns  A new client operating on a subpath of the current base path
   */
  scope (path: string): BaseClient {
    return new BaseClient(this.storage, this.makePath(path));
  }

  /**
   * Get a list of child nodes below a given path.
   *
   * @param {string} path - The path to query. It MUST end with a forward slash.
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached listing in milliseconds. See :ref:`max-age`.
   *
   * @returns {Promise} A promise for an object representing child nodes
   */
  // TODO add real return type
  async getListing (path?: string, maxAge?: false | number): Promise<unknown> {
    if (typeof path !== 'string') { path = ''; }
    else if (path.length > 0 && !isFolder(path)) {
      return Promise.reject("Not a folder: " + path);
    }

    return this.storage.get(this.makePath(path), maxAge).then((r: QueuedRequestResponse) => {
      return r.statusCode === 404 ? {} : r.body;
    });
  }

  /**
   * Get all objects directly below a given path.
   *
   * @param {string} path - Path to the folder. Must end in a forward slash.
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached objects in milliseconds. See :ref:`max-age`.
   *
   * @returns {Promise} A promise for an object
   */
  // TODO add real return type
  async getAll (path: string, maxAge?: false | number): Promise<unknown> {
    if (typeof path !== 'string') { path = ''; }
    else if (path.length > 0 && !isFolder(path)) {
      return Promise.reject("Not a folder: " + path);
    }

    return this.storage.get(this.makePath(path), maxAge).then((r: QueuedRequestResponse) => {
      if (r.statusCode === 404) { return {}; }
      if (typeof r.body === 'object') {
        const keys = Object.keys(r.body);
        // treat this like 404. it probably means a folder listing that
        // has changes that haven't been pushed out yet.
        if (keys.length === 0) { return {}; }

        const calls = keys.map((key: string) => {
          return this.storage.get(this.makePath(path + key), maxAge)
            .then((o: QueuedRequestResponse) => {
              if (typeof o.body === 'string') {
                try { o.body = JSON.parse(o.body); }
                catch (e) { /* empty */ }
              }
              if (typeof o.body === 'object') {
                r.body[key] = o.body;
              }
            });
        });

        return Promise.all(calls).then(() => { return r.body; });
      }
    });
  }

  /**
   * Get the file at the given path. A file is raw data, as opposed to
   * a JSON object (use :func:`getObject` for that).
   *
   * @param {string} path - Relative path from the module root (without leading
   *                        slash).
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          the cached file in milliseconds. See :ref:`max-age`.
   *
   * @returns {Promise} A promise for an object
   */
  // TODO add real return type
  async getFile (path: string, maxAge?: false | number): Promise<unknown> {
    if (typeof path !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.getFile must be a string');
    }

    return this.storage.get(this.makePath(path), maxAge).then((r: QueuedRequestResponse) => {
      return {
        data: r.body,
        contentType: r.contentType,
        revision: r.revision // (this is new)
      };
    });
  }

  /**
   * Store raw data at a given path.
   *
   * @param {string} mimeType - MIME media type of the data being stored
   * @param {string} path     - Path relative to the module root
   * @param {string|ArrayBuffer|ArrayBufferView} body - Raw data to store
   *
   * @returns {Promise} A promise for the created/updated revision (ETag)
   */
  async storeFile (mimeType: string, path: string, body: string | ArrayBuffer | ArrayBufferView): Promise<string> {
    if (typeof mimeType !== 'string') {
      return Promise.reject('Argument \'mimeType\' of baseClient.storeFile must be a string');
    }
    if (typeof path !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.storeFile must be a string');
    }
    if ((typeof body !== 'string') && (typeof body !== 'object')) {
      return Promise.reject('Argument \'body\' of baseClient.storeFile must be a string, ArrayBuffer, or ArrayBufferView');
    }
    if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
      console.warn('WARNING: Editing a document to which only read access (\'r\') was claimed');
    }

    return this.storage.put(this.makePath(path), body, mimeType).then((r: QueuedRequestResponse) => {
      if (r.statusCode === 200 || r.statusCode === 201) {
        return r.revision;
      } else {
        return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
      }
    });
  }

  /**
   * Get a JSON object from the given path.
   *
   * @param {string} path - Relative path from the module root (without leading
   *                        slash).
   * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
   *                          cached object in milliseconds. See :ref:`max-age`.
   *
   * @returns {Promise} A promise, which resolves with the requested object (or ``null``
   *          if non-existent)
   */

  // TODO add real return type
  async getObject (path: string, maxAge?: false | number): Promise<unknown> {
    if (typeof path !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.getObject must be a string');
    }

    return this.storage.get(this.makePath(path), maxAge).then((r: QueuedRequestResponse) => {
      if (typeof r.body === 'object') { // will be the case for documents stored with rs.js <= 0.10.0-beta2
        return r.body;
      } else if (typeof r.body === 'string') {
        try {
          return JSON.parse(r.body);
        } catch (e) {
          throw new Error("Not valid JSON: " + this.makePath(path));
        }
      } else if (typeof r.body !== 'undefined' && r.statusCode === 200) {
        return Promise.reject("Not an object: " + this.makePath(path));
      }
    });
  }

  /**
   * Store object at given path. Triggers synchronization.
   *
   * See ``declareType()`` and :doc:`data types </data-modules/defining-data-types>`
   * for an explanation of types
   *
   * For any given `path`, must not be called more frequently than once per second.
   *
   * @param {string} typeAlias   - Unique type of this object within this module.
   * @param {string} path   - Path relative to the module root.
   * @param {object} object - A JavaScript object to be stored at the given
   *                          path. Must be serializable as JSON.
   *
   * @returns {Promise} Resolves with revision on success. Rejects with
   *                    a ValidationError, if validations fail.
   */
  // TODO add real return type
  async storeObject (typeAlias: string, path: string, object: object): Promise<unknown> {
    if (typeof typeAlias !== 'string') {
      return Promise.reject('Argument \'typeAlias\' of baseClient.storeObject must be a string');
    }
    if (typeof path !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.storeObject must be a string');
    }
    if (typeof object !== 'object') {
      return Promise.reject('Argument \'object\' of baseClient.storeObject must be an object');
    }

    this._attachType(object, typeAlias);

    try {
      const validationResult = this.validate(object);
      if (!validationResult.valid) {
        return Promise.reject(validationResult);
      }
    } catch (exc) {
      return Promise.reject(exc);
    }

    return this.storage.put(this.makePath(path), JSON.stringify(object), 'application/json; charset=UTF-8').then((r: QueuedRequestResponse) => {
      if (r.statusCode === 200 || r.statusCode === 201) {
        return r.revision;
      } else {
        return Promise.reject("Request (PUT " + this.makePath(path) + ") failed with status: " + r.statusCode);
      }
    });
  }

  /**
   * Remove node at given path from storage. Triggers synchronization.
   *
   * @param {string} path - Path relative to the module root.
   * @returns {Promise}
   */
  // TODO add real return type
  remove (path: string): Promise<unknown> {
    if (typeof path !== 'string') {
      return Promise.reject('Argument \'path\' of baseClient.remove must be a string');
    }
    if (!this.storage.access.checkPathPermission(this.makePath(path), 'rw')) {
      console.warn('WARNING: Removing a document to which only read access (\'r\') was claimed');
    }

    return this.storage.delete(this.makePath(path));
  }

  /**
   * Retrieve full URL of a document. Useful for example for sharing the public
   * URL of an item in the ``/public`` folder.
   * TODO: refactor this into the Remote interface
   *
   * @param {string} path - Path relative to the module root.
   * @returns {string} The full URL of the item, including the storage origin
   */
  getItemURL (path: string): string {
    if (typeof path !== 'string') {
      throw 'Argument \'path\' of baseClient.getItemURL must be a string';
    }
    if (this.storage.connected) {
      path = cleanPath(this.makePath(path));
      return this.storage.remote.href + path;
    } else {
      return undefined;
    }
  }

  /**
   * Set caching strategy for a given path and its children.
   *
   * See :ref:`caching-strategies` for a detailed description of the available
   * strategies.
   *
   * @param {string} path - Path to cache
   * @param {string} strategy - Caching strategy. One of 'ALL', 'SEEN', or
   *                            'FLUSH'. Defaults to 'ALL'.
   *
   * @returns {BaseClient} The same instance this is called on to allow for method chaining
   */
  cache (path: string, strategy: 'ALL' | 'SEEN' | 'FLUSH' = 'ALL'): BaseClient {
    if (typeof path !== 'string') {
      throw 'Argument \'path\' of baseClient.cache must be a string';
    }
    if (typeof strategy !== 'string') {
      throw 'Argument \'strategy\' of baseClient.cache must be a string or undefined';
    }
    if (strategy !== 'FLUSH' &&
      strategy !== 'SEEN' &&
      strategy !== 'ALL') {
      throw 'Argument \'strategy\' of baseclient.cache must be one of '
      + '["FLUSH", "SEEN", "ALL"]';
    }

    this.storage.caching.set(this.makePath(path), strategy);
    return this;
  }

  /**
   * TODO: document
   *
   * @param {string} path
   */
  // TODO add return type once known
  flush (path: string): unknown {
    return this.storage.local.flush(path);
  }

  /**
   * Declare a remoteStorage object type using a JSON schema.
   *
   * See :doc:`Defining data types </data-modules/defining-data-types>` for more info.
   *
   * @param {string} alias  - A type alias/shortname
   * @param {uri}    uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
   * @param {object} schema - A JSON Schema object describing the object type
   **/
  declareType (alias: string, uriOrSchema: string|tv4.JsonSchema, schema?: tv4.JsonSchema): void {
    let uri: string;

    if (schema && typeof uriOrSchema === 'string') {
      uri = uriOrSchema;
    } else if (!schema && typeof uriOrSchema !== 'string') {
      schema = uriOrSchema;
      uri = this._defaultTypeURI(alias);
    } else if (!schema && typeof uriOrSchema === 'string')  {
      throw new Error('declareType() requires a JSON Schema object to be passed, in order to validate object types/formats');
    }

    BaseClient.Types.declare(this.moduleName, alias, uri, schema);
  }

  /**
   * Validate an object against the associated schema.
   *
   * @param {Object} object - JS object to validate. Must have a ``@context`` property.
   *
   * @returns {Object} An object containing information about validation errors
   **/
  validate (object: {[key: string]: any}): {[key: string]: any} {
    const schema = BaseClient.Types.getSchema(object['@context']);
    if (schema) {
      return tv4.validateResult(object, schema);
    } else {
      throw new SchemaNotFound(object['@context']);
    }
  }

  /**
   * TODO document
   *
   * @private
   */
  schemas = {
    configurable: true,

    get (): JsonSchemas {
      return BaseClient.Types.inScope(this.moduleName);
    }
  };

  /**
   * The default JSON-LD @context URL for RS types/objects/documents
   *
   * @private
   */
  _defaultTypeURI (alias: string): string {
    return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
  }

  /**
   * Attaches the JSON-LD @content to an object
   *
   * @private
   */
  _attachType (object: object, alias: string): void {
    object['@context'] = BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
  }

  /**
   * TODO: document
   *
   * @private
   */
  makePath (path: string): string {
    return this.base + (path || '');
  }

  /**
   * TODO: document
   *
   * @private
   */
  _fireChange (event: ChangeObj): void {
    if (config.changeEvents[event.origin]) {
      ['new', 'old', 'lastCommon'].forEach(function (fieldNamePrefix) {
        if ((!event[fieldNamePrefix + 'ContentType'])
          || (/^application\/(.*)json(.*)/.exec(event[fieldNamePrefix + 'ContentType']))) {
          if (typeof event[fieldNamePrefix + 'Value'] === 'string') {
            try {
              event[fieldNamePrefix + 'Value'] = JSON.parse(event[fieldNamePrefix + 'Value']);
            } catch (e) {
              // empty
            }
          }
        }
      });
      this._emit('change', event);
    }
  }

  static Types = Types;

  static _rs_init (): void {
    return;
  }
}

interface BaseClient extends EventHandling {}
applyMixins(BaseClient, [EventHandling]);

export = BaseClient;
