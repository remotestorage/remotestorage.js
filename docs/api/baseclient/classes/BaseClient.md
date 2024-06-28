# Class: BaseClient

Provides a high-level interface to access data below a given root path.

## Extends

- `EventHandling`

## Properties

### base

> **base**: `string`

Base path, which this [BaseClient](BaseClient.md) operates on.

For the module's privateClient this would be `<moduleName>`, for the
corresponding publicClient `/public/<moduleName>/`.

#### Source

[baseclient.ts:32](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L32)

***

### storage

> **storage**: [`RemoteStorage`](../../remotestorage/classes/RemoteStorage.md)

The [RemoteStorage](../../remotestorage/classes/RemoteStorage.md) instance this [BaseClient](BaseClient.md) operates on.

#### Source

[baseclient.ts:24](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L24)

## Methods

### cache()

> **cache**(`path`, `strategy`): [`BaseClient`](BaseClient.md)

Set caching strategy for a given path and its children.

See :ref:`caching-strategies` for a detailed description of the available
strategies.

#### Parameters

• **path**: `string`

Path to cache

• **strategy**: `"ALL"` \| `"SEEN"` \| `"FLUSH"`= `'ALL'`

Caching strategy. One of 'ALL', 'SEEN', or
                           'FLUSH'. Defaults to 'ALL'.

#### Returns

[`BaseClient`](BaseClient.md)

The same instance this is called on to allow for method chaining

#### Source

[baseclient.ts:321](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L321)

***

### declareType()

> **declareType**(`alias`, `uriOrSchema`, `schema`?): `void`

Declare a remoteStorage object type using a JSON schema.

See :doc:`Defining data types </data-modules/defining-data-types>` for more info.

#### Parameters

• **alias**: `string`

A type alias/shortname

• **uriOrSchema**: `string` \| `JsonSchema`

• **schema?**: `JsonSchema`

A JSON Schema object describing the object type

#### Returns

`void`

#### Source

[baseclient.ts:358](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L358)

***

### flush()

> **flush**(`path`): `unknown`

TODO: document

#### Parameters

• **path**: `string`

#### Returns

`unknown`

#### Source

[baseclient.ts:345](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L345)

***

### getAll()

> **getAll**(`path`, `maxAge`?): `Promise`\<`unknown`\>

Get all objects directly below a given path.

#### Parameters

• **path**: `string`

Path to the folder. Must end in a forward slash.

• **maxAge?**: `number` \| `false`

(optional) Either ``false`` or the maximum age of
                         cached objects in milliseconds. See :ref:`max-age`.

#### Returns

`Promise`\<`unknown`\>

A promise for an object

#### Source

[baseclient.ts:100](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L100)

***

### getFile()

> **getFile**(`path`, `maxAge`?): `Promise`\<`unknown`\>

Get the file at the given path. A file is raw data, as opposed to
a JSON object (use :func:`getObject` for that).

#### Parameters

• **path**: `string`

Relative path from the module root (without leading
                       slash).

• **maxAge?**: `number` \| `false`

(optional) Either ``false`` or the maximum age of
                         the cached file in milliseconds. See :ref:`max-age`.

#### Returns

`Promise`\<`unknown`\>

A promise for an object

#### Source

[baseclient.ts:144](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L144)

***

### getItemURL()

> **getItemURL**(`path`): `string`

Retrieve full URL of a document. Useful for example for sharing the public
URL of an item in the ``/public`` folder.
TODO: refactor this into the Remote interface

#### Parameters

• **path**: `string`

Path relative to the module root.

#### Returns

`string`

The full URL of the item, including the storage origin

#### Source

[baseclient.ts:297](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L297)

***

### getListing()

> **getListing**(`path`?, `maxAge`?): `Promise`\<`unknown`\>

Get a list of child nodes below a given path.

#### Parameters

• **path?**: `string`

The path to query. It MUST end with a forward slash.

• **maxAge?**: `number` \| `false`

(optional) Either ``false`` or the maximum age of
                         cached listing in milliseconds. See :ref:`max-age`.

#### Returns

`Promise`\<`unknown`\>

A promise for an object representing child nodes

#### Source

[baseclient.ts:79](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L79)

***

### getObject()

> **getObject**(`path`, `maxAge`?): `Promise`\<`unknown`\>

Get a JSON object from the given path.

#### Parameters

• **path**: `string`

Relative path from the module root (without leading
                       slash).

• **maxAge?**: `number` \| `false`

(optional) Either ``false`` or the maximum age of
                         cached object in milliseconds. See :ref:`max-age`.

#### Returns

`Promise`\<`unknown`\>

A promise, which resolves with the requested object (or ``null``
         if non-existent)

#### Source

[baseclient.ts:203](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L203)

***

### remove()

> **remove**(`path`): `Promise`\<`unknown`\>

Remove node at given path from storage. Triggers synchronization.

#### Parameters

• **path**: `string`

Path relative to the module root.

#### Returns

`Promise`\<`unknown`\>

#### Source

[baseclient.ts:278](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L278)

***

### scope()

> **scope**(`path`): [`BaseClient`](BaseClient.md)

Instantiate a new client, scoped to a subpath of the current client's
path.

#### Parameters

• **path**: `string`

The path to scope the new client to

#### Returns

[`BaseClient`](BaseClient.md)

A new client operating on a subpath of the current base path

#### Source

[baseclient.ts:65](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L65)

***

### storeFile()

> **storeFile**(`mimeType`, `path`, `body`): `Promise`\<`string`\>

Store raw data at a given path.

#### Parameters

• **mimeType**: `string`

MIME media type of the data being stored

• **path**: `string`

Path relative to the module root

• **body**: `string` \| `ArrayBuffer` \| `ArrayBufferView`

Raw data to store

#### Returns

`Promise`\<`string`\>

A promise for the created/updated revision (ETag)

#### Source

[baseclient.ts:167](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L167)

***

### storeObject()

> **storeObject**(`typeAlias`, `path`, `object`): `Promise`\<`unknown`\>

Store object at given path. Triggers synchronization.

See ``declareType()`` and :doc:`data types </data-modules/defining-data-types>`
for an explanation of types

For any given `path`, must not be called more frequently than once per second.

#### Parameters

• **typeAlias**: `string`

Unique type of this object within this module.

• **path**: `string`

Path relative to the module root.

• **object**: `object`

A JavaScript object to be stored at the given
                         path. Must be serializable as JSON.

#### Returns

`Promise`\<`unknown`\>

Resolves with revision on success. Rejects with
                   a ValidationError, if validations fail.

#### Source

[baseclient.ts:240](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L240)

***

### validate()

> **validate**(`object`): `object`

Validate an object against the associated schema.

#### Parameters

• **object**

JS object to validate. Must have a ``@context`` property.

#### Returns

`object`

An object containing information about validation errors

#### Source

[baseclient.ts:380](https://github.com/remotestorage/remotestorage.js/blob/4becb1901daee467dbfa441504b8a183899c93a2/src/baseclient.ts#L380)
