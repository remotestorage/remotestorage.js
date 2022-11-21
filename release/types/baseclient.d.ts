import tv4 from 'tv4';
import type { JsonSchemas } from './interfaces/json_schema';
import type { ChangeObj } from './interfaces/change_obj';
import EventHandling from './eventhandling';
import RemoteStorage from './remotestorage';
/**
 * Provides a high-level interface to access data below a given root path.
 */
declare class BaseClient {
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
    constructor(storage: RemoteStorage, base: string);
    /**
     * Instantiate a new client, scoped to a subpath of the current client's
     * path.
     *
     * @param path - The path to scope the new client to
     *
     * @returns  A new client operating on a subpath of the current base path
     */
    scope(path: string): BaseClient;
    /**
     * Get a list of child nodes below a given path.
     *
     * @param {string} path - The path to query. It MUST end with a forward slash.
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          cached listing in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise for an object representing child nodes
     */
    getListing(path?: string, maxAge?: false | number): Promise<unknown>;
    /**
     * Get all objects directly below a given path.
     *
     * @param {string} path - Path to the folder. Must end in a forward slash.
     * @param {number} maxAge - (optional) Either ``false`` or the maximum age of
     *                          cached objects in milliseconds. See :ref:`max-age`.
     *
     * @returns {Promise} A promise for an object
     */
    getAll(path: string, maxAge?: false | number): Promise<unknown>;
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
    getFile(path: string, maxAge?: false | number): Promise<unknown>;
    /**
     * Store raw data at a given path.
     *
     * @param {string} mimeType - MIME media type of the data being stored
     * @param {string} path     - Path relative to the module root
     * @param {string|ArrayBuffer|ArrayBufferView} body - Raw data to store
     *
     * @returns {Promise} A promise for the created/updated revision (ETag)
     */
    storeFile(mimeType: string, path: string, body: string | ArrayBuffer | ArrayBufferView): Promise<string>;
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
    getObject(path: string, maxAge?: false | number): Promise<unknown>;
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
    storeObject(typeAlias: string, path: string, object: object): Promise<unknown>;
    /**
     * Remove node at given path from storage. Triggers synchronization.
     *
     * @param {string} path - Path relative to the module root.
     * @returns {Promise}
     */
    remove(path: string): Promise<unknown>;
    /**
     * Retrieve full URL of a document. Useful for example for sharing the public
     * URL of an item in the ``/public`` folder.
     * TODO: refactor this into the Remote interface
     *
     * @param {string} path - Path relative to the module root.
     * @returns {string} The full URL of the item, including the storage origin
     */
    getItemURL(path: string): string;
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
    cache(path: string, strategy?: 'ALL' | 'SEEN' | 'FLUSH'): BaseClient;
    /**
     * TODO: document
     *
     * @param {string} path
     */
    flush(path: string): unknown;
    /**
     * Declare a remoteStorage object type using a JSON schema.
     *
     * See :doc:`Defining data types </data-modules/defining-data-types>` for more info.
     *
     * @param {string} alias  - A type alias/shortname
     * @param {uri}    uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
     * @param {object} schema - A JSON Schema object describing the object type
     **/
    declareType(alias: string, uriOrSchema: string | tv4.JsonSchema, schema?: tv4.JsonSchema): void;
    /**
     * Validate an object against the associated schema.
     *
     * @param {Object} object - JS object to validate. Must have a ``@context`` property.
     *
     * @returns {Object} An object containing information about validation errors
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
     * Attaches the JSON-LD @content to an object
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
interface BaseClient extends EventHandling {
}
export = BaseClient;
//# sourceMappingURL=baseclient.d.ts.map