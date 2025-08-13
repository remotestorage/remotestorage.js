import tv4 from 'tv4';
import type RemoteStorage from './remotestorage';
import type { JsonSchemas } from './interfaces/json_schema';
import type { ChangeObj } from './interfaces/change_obj';
import type { QueuedRequestResponse } from './interfaces/queued_request_response';
import EventHandling from './eventhandling';
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
 * * {@link getFile} and {@link storeFile} operates on files. Each file has a
 *   content/MIME type.
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
 * > If {@link caching!Caching caching} for the folder is turned off, none of
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
 * > Automatically receiving remote changes depends on the
 * > {@link caching!Caching caching} settings for your module/paths.
 *
 * ### `window`
 *
 * Events with origin `window` are fired whenever you change a value by calling a
 * method on the `BaseClient`; these are disabled by default.
 *
 * > [!TIP]
 * > You can enable them by configuring `changeEvents` for your
 * > {@link RemoteStorage remoteStorage} instance.
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
 * However, when this change is pushed out by the sync process, it will be
 * rejected by the server, if the remote version has changed in the meantime,
 * for example from `white` to `red`. This will lead to a change event with
 * origin `conflict`, usually a few seconds after the event with origin
 * `window`. Note that since you already changed it from `white` to `blue` in
 * the local version a few seconds ago, `oldValue` is now your local value of
 * `blue`:
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
 *
 * If no algorithm exists, conflict resolution typically involves displaying local
 * and remote versions to the user, and having the user merge them, or choose
 * which version to keep.
 */
export declare class BaseClient {
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
    constructor(storage: RemoteStorage, base: string);
    /**
     * Instantiate a new client, scoped to a subpath of the current client's
     * path.
     *
     * @param path - The path to scope the new client to
     *
     * @returns A new `BaseClient` operating on a subpath of the current base path
     */
    scope(path: string): BaseClient;
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
    getListing(path?: string, maxAge?: false | number): Promise<unknown>;
    /**
     * Get all objects directly below a given path.
     *
     * @param path   - (optional) Path to the folder. Must end in a forward slash.
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
    getAll(path?: string, maxAge?: false | number): Promise<unknown>;
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
     * * `contentType`<br>
     *    String containing the MIME Type of the document. (Usually just the
     *    MIME type, but can theoretically contain extra metadata such as `charset`
     *    for example.)
     * * `data`<br>
     *    Raw data of the document (either a string or an ArrayBuffer)
     *
     * @example
     * Displaying an image:
     *
     * ```js
     * client.getFile('path/to/some/image').then(file => {
     *   const blob = new Blob([file.data], { type: file.contentType });
     *   const targetElement = document.findElementById('my-image-element');
     *   targetElement.src = window.URL.createObjectURL(blob);
     * });
     * ```
     */
    getFile(path: string, maxAge?: false | number): Promise<unknown>;
    /**
     * Store raw data at a given path.
     *
     * @param contentType - Content type (MIME media type) of the data being stored
     * @param path        - Path relative to the module root
     * @param body        - Raw data to store
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
    storeFile(contentType: string, path: string, body: string | ArrayBuffer | ArrayBufferView): Promise<string>;
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
    getObject(path: string, maxAge?: false | number): Promise<unknown>;
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
    storeObject(typeAlias: string, path: string, object: object): Promise<string>;
    /**
     * Remove node at given path from storage. Triggers synchronization.
     *
     * @param path - Path relative to the module root.
     *
     * @example
     * client.remove('path/to/object').then(() => console.log('item deleted'));
     */
    remove(path: string): Promise<QueuedRequestResponse>;
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
    getItemURL(path: string): string | undefined;
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
    cache(path: string, strategy?: 'ALL' | 'SEEN' | 'FLUSH'): BaseClient;
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
    declareType(alias: string, uriOrSchema: string | tv4.JsonSchema, schema?: tv4.JsonSchema): void;
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
    validate(object: {
        [key: string]: any;
    }): {
        [key: string]: any;
    };
    /**
     * TODO document
     *
     * @private
     */
    schemas: {
        configurable: boolean;
        get(): JsonSchemas;
    };
    /**
     * The default JSON-LD @context URL for RS types/objects/documents
     *
     * @private
     */
    _defaultTypeURI(alias: string): string;
    /**
     * Attaches the JSON-LD @context to an object
     *
     * @private
     */
    _attachType(object: object, alias: string): void;
    /**
     * TODO: document
     *
     * @private
     */
    makePath(path: string): string;
    /**
     * TODO: document
     *
     * @private
     */
    _fireChange(event: ChangeObj): void;
    static Types: import("./types").BaseClientTypes;
    static _rs_init(): void;
}
export interface BaseClient extends EventHandling {
}
export default BaseClient;
//# sourceMappingURL=baseclient.d.ts.map