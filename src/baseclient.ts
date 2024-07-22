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
 * A `BaseClient` instance is the main endpoint you will use for interacting
 * with a connected storage: listing, reading, creating, updating and deleting
 * documents, as well as handling incoming changes.
 *
 * Base clients are usually used in [data modules](../../../data-modules/),
 * which are loaded with two `BaseClient` instances by default: one for private
 * and one for public documents.
 *
 * However, you can also instantiate a BaseClient outside of a data module using
 * the `remoteStorage.scope()` function. Similarly, you can create a new scoped
 * client within another client, using the `BaseClient`'s own {@link scope}.
 *
 * ## Read/write operations
 *
 * A `BaseClient` deals with three types of data: folders, objects and files.
 *
 * * {@link getListing} returns a mapping of all items within a folder.
 *
 * * {@link getObject} and {@link storeObject} operate on JSON objects. Each object
 *   has a type.
 *
 * * {@link getFile} and {@link storeFile} operates on files. Each file has a MIME
 *   type.
 *
 * * {@link getAll} returns all objects or files for the given folder path.
 *
 * * {@link remove} operates on either objects or files (but not folders; folders
 *   are created and removed implictly).
 *
 * ## Caching logic for read operations
 *
 * All functions requesting/reading data will immediately return data from the
 * local store, *as long as it is reasonably up-to-date*. If data is assumed to be
 * potentially outdated, they will check the remote storage for changes first, and then
 * return the requested data.
 *
 * The default maximum age of requested data is two times the periodic sync
 * interval (10 seconds by default).
 *
 * However, you can adjust this behavior by using the `maxAge` argument with any
 * of these functions, thereby changing the maximum age or removing the
 * requirement entirely.
 *
 * * If the `maxAge` requirement is set, and the last sync request for the path
 *   is further in the past than the maximum age given, the folder will first be
 *   checked for changes on the remote, and then the promise will be fulfilled
 *   with the up-to-date document or listing.
 *
 * * If the `maxAge` requirement is set, and cannot be met because of network
 *   problems, the promise will be rejected.
 *
 * * If the `maxAge` requirement is set to `false`, or the library is in
 *   offline mode, or no remote storage is connected (a.k.a.  "anonymous mode"),
 *   the promise will always be fulfilled with data from the local store.
 *
 * > [!NOTE]
 * > If {@link Caching caching} for the folder is turned off, none of
 * > this applies and data will always be requested from the remote store
 * > directly.
 *
 * ## Change events
 *
 * A `BaseClient` emits only one type of event, named `change`, which you can add
 * a handler for using the `.on()` function (same as with {@link RemoteStorage}):
 *
 * ```js
 * client.on('change', function (evt) {
 *   console.log('data was added, updated, or removed:', evt)
 * });
 * ```
 *
 * Using this event, your app can stay informed about data changes, both remote
 * (from other devices or browsers), as well as locally (e.g. other browser tabs).
 *
 * In order to determine where a change originated from, look at the `origin`
 * property of the event. Possible values are `window`, `local`, `remote`, and
 * `conflict`, explained in detail below.
 *
 * #### Example
 *
 * ```js
 * {
 *   // Absolute path of the changed node, from the storage root
 *   path: path,
 *   // Path of the changed node, relative to this baseclient's scope root
 *   relativePath: relativePath,
 *   // See origin descriptions below
 *   origin: 'window|local|remote|conflict',
 *   // Old body of the changed node (local version in conflicts; undefined if creation)
 *   oldValue: oldBody,
 *   // New body of the changed node (remote version in conflicts; undefined if deletion)
 *   newValue: newBody,
 *   // Body when local and remote last agreed; only present in conflict events
 *   lastCommonValue: lastCommonBody,
 *   // Old contentType of the changed node (local version for conflicts; undefined if creation)
 *   oldContentType: oldContentType,
 *   // New contentType of the changed node (remote version for conflicts; undefined if deletion)
 *   newContentType: newContentType,
 *   // ContentType when local and remote last agreed; only present in conflict events
 *   lastCommonContentType: lastCommonContentType
 * }
 * ```
 *
 * ### `local`
 *
 * Events with origin `local` are fired conveniently during the page load, so
 * that you can fill your views when the page loads.
 *
 * Example:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'local',
 *   oldValue: undefined,
 *   newValue: 'white',
 *   oldContentType: undefined,
 *   newContentType: 'text/plain'
 * }
 * ```
 *
 * > [!TIP]
 * > You may also use for example {@link getAll} instead, and choose to
 * > deactivate these.
 *
 * ### `remote`
 *
 * Events with origin `remote` are fired when remote changes are discovered
 * during sync.
 *
 * > [!NOTE]
 * > Automatically receiving remote changes depends on the {@link Caching} settings
 * > for your module/paths.
 *
 * ### `window`
 *
 * Events with origin `window` are fired whenever you change a value by calling a
 * method on the `BaseClient`; these are disabled by default.
 *
 * > [!TIP]
 * > You can enable them by configuring `changeEvents` for your
 * > {@link RemoteStorage} instance.
 *
 * ### `conflict`
 *
 * Events with origin `conflict` are fired when a conflict occurs while pushing
 * out your local changes to the remote store.
 *
 * Let's say you changed the content of `color.txt` from `white` to `blue`; if
 * you have set `config.changeEvents.window` to `true` for your {@link
 * RemoteStorage} instance, then you will receive:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'window',
 *   oldValue: 'white',
 *   newValue: 'blue',
 *   oldContentType: 'text/plain',
 *   newContentType: 'text/plain'
 * }
 * ```
 *
 * But when this change is pushed out by asynchronous synchronization, this change
 * may be rejected by the server, if the remote version has in the meantime changed
 * from `white` to  for instance `red`; this will then lead to a change event with
 * origin `conflict` (usually a few seconds after the event with origin `window`,
 * if you have those activated). Note that since you already changed it from
 * `white` to `blue` in the local version a few seconds ago, `oldValue` is now
 * your local value of `blue`:
 *
 * ```js
 * {
 *   path: '/public/design/color.txt',
 *   relativePath: 'color.txt',
 *   origin: 'conflict',
 *   oldValue: 'blue',
 *   newValue: 'red',
 *   oldContentType: 'text/plain',
 *   newContentType: 'text/plain',
 *   // Most recent known common ancestor body of local and remote
 *   lastCommonValue: 'white',
 *   // Most recent known common ancestor contentType of local and remote
 *   lastCommonContentType: 'text/plain'
 * }
 * ```
 *
 * #### Conflict Resolution
 *
 * Conflicts are resolved by calling {@link storeObject} or {@link storeFile} on
 * the device where the conflict surfaced. Other devices are not aware of the
 * conflict.
 *
 * If there is an algorithm to merge the differences between local and remote
 * versions of the data, conflicts may be automatically resolved.
 * {@link storeObject} or {@link storeFile} must not be called synchronously from
 * the change event handler, nor by chaining Promises. {@link storeObject} or
 * {@link storeFile} must not be called until the next iteration of the JavaScript
 * Task Queue, using for example
 * [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout).
 *
 * If no algorithm exists, conflict resolution typically involves displaying local
 * and remote versions to the user, and having the user merge them, or choose
 * which version to keep.
 */
export class BaseClient {
  /**
   * The {@link RemoteStorage} instance this {@link BaseClient} operates on.
   *
   * @internal
   */
  storage: RemoteStorage;

  /**
   * Base path, which this {@link BaseClient} operates on.
   *
   * For the module's `privateClient` this would be the module name, and for the
   * corresponding `publicClient` it is `/public/<moduleName>/`.
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
   * @returns A new `BaseClient` operating on a subpath of the current base path
   */
  scope (path: string): BaseClient {
    return new BaseClient(this.storage, this.makePath(path));
  }

  /**
   * Get a list of child nodes below a given path.
   *
   * @param path   - The path to query. It must end with a forward slash.
   * @param maxAge - (optional) Either `false` or the maximum age of cached
   *                 listing in milliseconds. See [caching logic for read
   *                 operations](#caching-logic-for-read-operations).
   *
   * @returns A promise for a folder listing object
   *
   * @example
   * ```js
   * client.getListing().then(listing => console.log(listing));
   * ```
   *
   * The folder listing is returned as a JSON object, with the root keys
   * representing the pathnames of child nodes. Keys ending in a forward slash
   * represent _folder nodes_ (subdirectories), while all other keys represent
   * _data nodes_ (files/objects).
   *
   * Data node information contains the item's ETag, content type and -length.
   *
   * Example of a listing object:
   *
   * ```js
   * {
   *   "@context": "http://remotestorage.io/spec/folder-description",
   *   "items": {
   *     "thumbnails/": true,
   *     "screenshot-20170902-1913.png": {
   *       "ETag": "6749fcb9eef3f9e46bb537ed020aeece",
   *       "Content-Length": 53698,
   *       "Content-Type": "image/png;charset=binary"
   *     },
   *     "screenshot-20170823-0142.png": {
   *       "ETag": "92ab84792ef3f9e46bb537edac9bc3a1",
   *       "Content-Length": 412401,
   *       "Content-Type": "image/png;charset=binary"
   *     }
   *   }
   * }
   * ```
   *
   * > [!WARNING]
   * > At the moment, this function only returns detailed metadata, when
   * > caching is turned off. With caching turned on, it will only contain the
   * > item names as properties with `true` as value. See issues 721 and 1108 —
   * > contributions welcome!
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
   * @param path   - Path to the folder. Must end in a forward slash.
   * @param maxAge - (optional) Either `false` or the maximum age of cached
   *                 objects in milliseconds. See [caching logic for read
   *                 operations](#caching-logic-for-read-operations).

   *
   * @returns A promise for a collection of items
   *
   * @example
   * ```js
   * client.getAll('example-subdirectory/').then(objects => {
   *   for (var path in objects) {
   *     console.log(path, objects[path]);
   *   }
   * });
   * ```
   *
   * Example response:
   *
   * ```js
   * {
   *   "27b8dc16483734625fff9de653a14e03": {
   *     "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
   *     "id": "27b8dc16483734625fff9de653a14e03",
   *     "url": "https://unhosted.org/",
   *     "title": "Unhosted Web Apps",
   *     "description": "Freedom from web 2.0's monopoly platforms",
   *     "tags": [
   *       "unhosted",
   *       "remotestorage"
   *     ],
   *     "createdAt": "2017-11-02T15:22:25.289Z",
   *     "updatedAt": "2019-11-07T17:52:22.643Z"
   *   },
   *   "900a5ca174bf57c56b79af0653053bdc": {
   *     "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
   *     "id": "900a5ca174bf57c56b79af0653053bdc",
   *     "url": "https://remotestorage.io/",
   *     "title": "remoteStorage",
   *     "description": "An open protocol for per-user storage on the Web",
   *     "tags": [
   *       "unhosted",
   *       "remotestorage"
   *     ],
   *     "createdAt": "2019-11-07T17:59:34.883Z"
   *   }
   * }
   * ```
   * > [!NOTE]
   * > For items that are not JSON-stringified objects (for example stored using
   * > {@link storeFile} instead of {@link storeObject}), the object's value is
   * > filled in with `true`.
   *
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
   * a JSON object (use {@link getObject} for that).
   *
   *
   * @param path   - Relative path from the module root (without leading slash).
   * @param maxAge - (optional) Either ``false`` or the maximum age of
   *                 the cached file in milliseconds. See [caching logic for read
   *                 operations](#caching-logic-for-read-operations).
   *
   * @returns An object containing the content type as well as the file's content:
   *
   * * `mimeType`<br>
   *    String representing the MIME Type of the document.
   * * `data`<br>
   *    Raw data of the document (either a string or an ArrayBuffer)
   *
   * @example
   * Displaying an image:
   *
   * ```js
   * client.getFile('path/to/some/image').then(file => {
   *   const blob = new Blob([file.data], { type: file.mimeType });
   *   const targetElement = document.findElementById('my-image-element');
   *   targetElement.src = window.URL.createObjectURL(blob);
   * });
   * ```
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
   * @param mimeType - MIME media type of the data being stored
   * @param path     - Path relative to the module root
   * @param body     - Raw data to store
   *
   * @returns A promise for the created/updated revision (ETag)
   *
   * @example
   * UTF-8 data:
   *
   * ```js
   * client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>')
   *       .then(() => { console.log("File saved") });
   * ```
   *
   * Binary data:
   *
   * ```js
   * const input = document.querySelector('form#upload input[type=file]');
   * const file = input.files[0];
   * const fileReader = new FileReader();
   *
   * fileReader.onload = function () {
   *   client.storeFile(file.type, file.name, fileReader.result)
   *         .then(() => { console.log("File saved") });
   * };
   *
   * fileReader.readAsArrayBuffer(file);
   * ```
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
   * @param path - Relative path from the module root (without leading slash).
   * @param maxAge - (optional) Either `false` or the maximum age of
   *                 cached object in milliseconds. See [caching logic for read
   *                 operations](#caching-logic-for-read-operations).
   *
   * @returns A promise, resolving with the requested object, or `null` if non-existent
   *
   * @example
   * client.getObject('/path/to/object').then(obj => console.log(obj));
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
   * Store an object at given path. Triggers synchronization. See {@link
   * declareType} and
   * [Defining data types](../../../data-modules/defining-data-types)
   * for info on object types.
   *
   * Must not be called more than once per second for any given `path`.
   *
   * @param typeAlias - Unique type of this object within this module.
   * @param path      - Path relative to the module root.
   * @param object    - A JavaScript object to be stored at the given path.
   *                    Must be serializable as JSON.
   *
   * @returns Resolves with revision on success. Rejects with an error object,
   *          if schema validations fail.
   *
   * @example
   * const bookmark = {
   *   url: 'http://unhosted.org',
   *   description: 'Unhosted Adventures',
   *   tags: ['unhosted', 'remotestorage', 'no-backend']
   * }
   * const path = MD5Hash(bookmark.url);

   * client.storeObject('bookmark', path, bookmark)
   *       .then(() => console.log('bookmark saved'))
   *       .catch((err) => console.log(err));
   */
  async storeObject (typeAlias: string, path: string, object: object): Promise<string> {
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
   * @param path - Path relative to the module root.
   *
   * @example
   * client.remove('path/to/object').then(() => console.log('item deleted'));
   */
  // TODO add real return type
  // TODO Don't return the RemoteResponse directly, handle response properly
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
   *
   * @param path - Path relative to the module root.
   *
   * @returns The full URL of the item, including the storage origin, or `undefined`
   *          if no remote storage is connected
   *
   * > [!WARNING]
   * > This method currently only works for remoteStorage
   * > backends. The GitHub issues for implementing it for Dropbox and Google
   * > are 1052 and 1054.
   */
  // TODO refactor this into the Remote interface
  getItemURL (path: string): string | undefined {
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
   * See [Caching strategies](../../caching/classes/Caching.html#caching-strategies)
   * for a detailed description of the available strategies.
   *
   * @param path - Path to cache
   * @param strategy - Caching strategy. One of 'ALL', 'SEEN', or FLUSH'.
   *                   Defaults to 'ALL'.
   *
   * @returns The same `BaseClient` instance this method is called on to allow
   *          for method chaining
   *
   * @example
   * client.cache('lists/', 'SEEN');
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
   * Declare a remoteStorage object type using a JSON Schema. Visit
   * [json-schema.org](http://json-schema.org) for details.
   *
   * See [Defining data types](../../../data-modules/defining-data-types) for more info.
   *
   * @param alias       - A type alias/shortname
   * @param uriOrSchema - JSON-LD URI of the schema, or a JSON Schema object.
   *                      The URI is automatically generated if none given.
   * @param schema      - (optional) A JSON Schema object describing the object type
   *
   * @example
   * client.declareType('todo-item', {
   *   "type": "object",
   *   "properties": {
   *     "id": {
   *       "type": "string"
   *     },
   *     "title": {
   *       "type": "string"
   *     },
   *     "finished": {
   *       "type": "boolean"
   *       "default": false
   *     },
   *     "createdAt": {
   *       "type": "date"
   *     }
   *   },
   *   "required": ["id", "title"]
   * })
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
   * @param object - JS object to validate. Must have a `@context` property.
   *
   * @returns An object containing information about the validation result
   *
   * @example
   * var result = client.validate(document);
   *
   * // result:
   * // {
   * //   error: null,
   * //   missing: [],
   * //   valid: true
   * // }
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
   * Attaches the JSON-LD @context to an object
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

export interface BaseClient extends EventHandling {}
applyMixins(BaseClient, [EventHandling]);

export default BaseClient;
