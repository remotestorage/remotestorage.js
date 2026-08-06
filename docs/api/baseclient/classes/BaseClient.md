# Class: BaseClient

Defined in: [baseclient.ts:220](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L220)

A `BaseClient` instance is the main endpoint you will use for interacting
with a connected storage: listing, reading, creating, updating and deleting
documents, as well as handling incoming changes.

Base clients are usually used in [data modules](../../../data-modules/),
which are loaded with two `BaseClient` instances by default: one for private
and one for public documents.

However, you can also instantiate a BaseClient outside of a data module using
the `remoteStorage.scope()` function. Similarly, you can create a new scoped
client within another client, using the `BaseClient`'s own [scope](#scope).

## Read/write operations

A `BaseClient` deals with three types of data: folders, objects and files.

* [getListing](#getlisting) returns a mapping of all items within a folder.

* [getObject](#getobject) and [storeObject](#storeobject) operate on JSON objects. Each object
  has a type.

* [getFile](#getfile) and [storeFile](#storefile) operates on files. Each file has a
  content/MIME type.

* [getAll](#getall) returns all objects or files for the given folder path.

* [remove](#remove) operates on either objects or files (but not folders; folders
  are created and removed implictly).

## Caching logic for read operations

All functions requesting/reading data will immediately return data from the
local store, *as long as it is reasonably up-to-date*. If data is assumed to be
potentially outdated, they will check the remote storage for changes first, and then
return the requested data.

The default maximum age of requested data is two times the periodic sync
interval (10 seconds by default).

However, you can adjust this behavior by using the `maxAge` argument with any
of these functions, thereby changing the maximum age or removing the
requirement entirely.

* If the `maxAge` requirement is set, and the last sync request for the path
  is further in the past than the maximum age given, the folder will first be
  checked for changes on the remote, and then the promise will be fulfilled
  with the up-to-date document or listing.

* If the `maxAge` requirement is set, and cannot be met because of network
  problems, the promise will be rejected.

* If the `maxAge` requirement is set to `false`, or the library is in
  offline mode, or no remote storage is connected (a.k.a.  "anonymous mode"),
  the promise will always be fulfilled with data from the local store.

> [!NOTE]
> If [caching](../../caching/classes/Caching.md) for the folder is turned off, none of
> this applies and data will always be requested from the remote store
> directly.

## Change events

A `BaseClient` emits only one type of event, named `change`, which you can add
a handler for using the `.on()` function (same as with [RemoteStorage](../../remotestorage/classes/RemoteStorage.md)):

```js
client.on('change', function (evt) {
  console.log('data was added, updated, or removed:', evt)
});
```

Using this event, your app can stay informed about data changes, both remote
(from other devices or browsers), as well as locally (e.g. other browser tabs).

In order to determine where a change originated from, look at the `origin`
property of the event. Possible values are `window`, `local`, `remote`, and
`conflict`, explained in detail below.

#### Example

```js
{
  // Absolute path of the changed node, from the storage root
  path: path,
  // Path of the changed node, relative to this baseclient's scope root
  relativePath: relativePath,
  // See origin descriptions below
  origin: 'window|local|remote|conflict',
  // Old body of the changed node (local version in conflicts; undefined if creation)
  oldValue: oldBody,
  // New body of the changed node (remote version in conflicts; undefined if deletion)
  newValue: newBody,
  // Body when local and remote last agreed; only present in conflict events
  lastCommonValue: lastCommonBody,
  // Old contentType of the changed node (local version for conflicts; undefined if creation)
  oldContentType: oldContentType,
  // New contentType of the changed node (remote version for conflicts; undefined if deletion)
  newContentType: newContentType,
  // ContentType when local and remote last agreed; only present in conflict events
  lastCommonContentType: lastCommonContentType
}
```

### `local`

Events with origin `local` are fired conveniently during the page load, so
that you can fill your views when the page loads.

Example:

```js
{
  path: '/public/design/color.txt',
  relativePath: 'color.txt',
  origin: 'local',
  oldValue: undefined,
  newValue: 'white',
  oldContentType: undefined,
  newContentType: 'text/plain'
}
```

> [!TIP]
> You may also use for example [getAll](#getall) instead, and choose to
> deactivate these.

### `remote`

Events with origin `remote` are fired when remote changes are discovered
during sync.

> [!NOTE]
> Automatically receiving remote changes depends on the
> [caching](../../caching/classes/Caching.md) settings for your module/paths.

### `window`

Events with origin `window` are fired whenever you change a value by calling a
method on the `BaseClient`; these are disabled by default.

> [!TIP]
> You can enable them by configuring `changeEvents` for your
> [remoteStorage](../../remotestorage/classes/RemoteStorage.md) instance.

### `conflict`

Events with origin `conflict` are fired when a conflict occurs while pushing
out your local changes to the remote store.

Let's say you changed the content of `color.txt` from `white` to `blue`; if
you have set `config.changeEvents.window` to `true` for your RemoteStorage instance, then you will receive:

```js
{
  path: '/public/design/color.txt',
  relativePath: 'color.txt',
  origin: 'window',
  oldValue: 'white',
  newValue: 'blue',
  oldContentType: 'text/plain',
  newContentType: 'text/plain'
}
```

However, when this change is pushed out by the sync process, it will be
rejected by the server, if the remote version has changed in the meantime,
for example from `white` to `red`. This will lead to a change event with
origin `conflict`, usually a few seconds after the event with origin
`window`. Note that since you already changed it from `white` to `blue` in
the local version a few seconds ago, `oldValue` is now your local value of
`blue`:

```js
{
  path: '/public/design/color.txt',
  relativePath: 'color.txt',
  origin: 'conflict',
  oldValue: 'blue',
  newValue: 'red',
  oldContentType: 'text/plain',
  newContentType: 'text/plain',
  // Most recent known common ancestor body of local and remote
  lastCommonValue: 'white',
  // Most recent known common ancestor contentType of local and remote
  lastCommonContentType: 'text/plain'
}
```

#### Conflict Resolution

Conflicts are resolved by calling [storeObject](#storeobject) or [storeFile](#storefile) on
the device where the conflict surfaced. Other devices are not aware of the
conflict.

If there is an algorithm to merge the differences between local and remote
versions of the data, conflicts may be automatically resolved.

If no algorithm exists, conflict resolution typically involves displaying local
and remote versions to the user, and having the user merge them, or choose
which version to keep.

## Properties

### base

> **base**: `string`

Defined in: [baseclient.ts:234](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L234)

Base path, which this BaseClient operates on.

For the module's `privateClient` this would be the module name, and for the
corresponding `publicClient` it is `/public/<moduleName>/`.

## Methods

### addEventListener()

> **addEventListener**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:29](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/eventhandling.ts#L29)

Install an event handler for the given event name

Usually called via [`on()`](#on)

#### Parameters

##### eventName

`string`

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

***

### cache()

> **cache**(`path`, `strategy?`): `BaseClient`

Defined in: [baseclient.ts:679](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L679)

Set caching strategy for a given path and its children.

See [Caching strategies](../../caching/classes/Caching.html#caching-strategies)
for a detailed description of the available strategies.

#### Parameters

##### path

`string`

Path to cache

##### strategy?

`"ALL"` \| `"SEEN"` \| `"FLUSH"`

Caching strategy. One of 'ALL', 'SEEN', or FLUSH'.
                  Defaults to 'ALL'.

#### Returns

`BaseClient`

The same `BaseClient` instance this method is called on to allow
         for method chaining

#### Example

```ts
client.cache('lists/', 'SEEN');
```

***

### declareType()

> **declareType**(`alias`, `uriOrSchema`, `schema?`): `void`

Defined in: [baseclient.ts:729](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L729)

Declare a remoteStorage object type using a JSON Schema. Visit
[json-schema.org](http://json-schema.org) for details.

See [Defining data types](../../../data-modules/defining-data-types) for more info.

#### Parameters

##### alias

`string`

A type alias/shortname

##### uriOrSchema

`string` \| `JsonSchema`

JSON-LD URI of the schema, or a JSON Schema object.
                     The URI is automatically generated if none given.

##### schema?

`JsonSchema`

(optional) A JSON Schema object describing the object type

#### Returns

`void`

#### Example

```ts
client.declareType('todo-item', {
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "finished": {
      "type": "boolean"
      "default": false
    },
    "createdAt": {
      "type": "date"
    }
  },
  "required": ["id", "title"]
})
```

***

### getAll()

> **getAll**(`path?`, `maxAge?`): `Promise`\<`unknown`\>

Defined in: [baseclient.ts:390](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L390)

Get all objects directly below a given path.

#### Parameters

##### path?

`string`

(optional) Path to the folder. Must end in a forward slash.

##### maxAge?

`number` \| `false`

(optional) Either `false` or the maximum age of cached
                objects in milliseconds. See [caching logic for read
                operations](#caching-logic-for-read-operations).

#### Returns

`Promise`\<`unknown`\>

A promise for a collection of items

#### Example

```js
client.getAll('example-subdirectory/').then(objects => {
  for (var path in objects) {
    console.log(path, objects[path]);
  }
});
```

Example response:

```js
{
  "27b8dc16483734625fff9de653a14e03": {
    "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
    "id": "27b8dc16483734625fff9de653a14e03",
    "url": "https://unhosted.org/",
    "title": "Unhosted Web Apps",
    "description": "Freedom from web 2.0's monopoly platforms",
    "tags": [
      "unhosted",
      "remotestorage"
    ],
    "createdAt": "2017-11-02T15:22:25.289Z",
    "updatedAt": "2019-11-07T17:52:22.643Z"
  },
  "900a5ca174bf57c56b79af0653053bdc": {
    "@context": "http://remotestorage.io/spec/modules/bookmarks/archive-bookmark",
    "id": "900a5ca174bf57c56b79af0653053bdc",
    "url": "https://remotestorage.io/",
    "title": "remoteStorage",
    "description": "An open protocol for per-user storage on the Web",
    "tags": [
      "unhosted",
      "remotestorage"
    ],
    "createdAt": "2019-11-07T17:59:34.883Z"
  }
}
```
> [!NOTE]
> For items that are not JSON-stringified objects (for example stored using
> [storeFile](#storefile) instead of [storeObject](#storeobject)), the object's value is
> filled in with `true`.

***

### getFile()

> **getFile**(`path`, `maxAge?`): `Promise`\<`unknown`\>

Defined in: [baseclient.ts:452](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L452)

Get the file at the given path. A file is raw data, as opposed to
a JSON object (use [getObject](#getobject) for that).

#### Parameters

##### path

`string`

Relative path from the module root (without leading slash).

##### maxAge?

`number` \| `false`

(optional) Either ``false`` or the maximum age of
                the cached file in milliseconds. See [caching logic for read
                operations](#caching-logic-for-read-operations).

#### Returns

`Promise`\<`unknown`\>

An object containing the content type as well as the file's content:

* `contentType`<br>
   String containing the MIME Type of the document. (Usually just the
   MIME type, but can theoretically contain extra metadata such as `charset`
   for example.)
* `data`<br>
   Raw data of the document (either a string or an ArrayBuffer)

#### Example

Displaying an image:

```js
client.getFile('path/to/some/image').then(file => {
  const blob = new Blob([file.data], { type: file.contentType });
  const targetElement = document.findElementById('my-image-element');
  targetElement.src = window.URL.createObjectURL(blob);
});
```

***

### getItemURL()

> **getItemURL**(`path`): `string`

Defined in: [baseclient.ts:651](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L651)

Retrieve full URL of a document. Useful for example for sharing the public
URL of an item in the ``/public`` folder.

#### Parameters

##### path

`string`

Path relative to the module root.

#### Returns

`string`

The full URL of the item, including the storage origin, or `undefined`
         if no remote storage is connected

> [!WARNING]
> This method currently only works for remoteStorage
> backends. The GitHub issues for implementing it for Dropbox and Google
> are 1052 and 1054.

***

### getListing()

> **getListing**(`path?`, `maxAge?`): `Promise`\<`unknown`\>

Defined in: [baseclient.ts:321](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L321)

Get a list of child nodes below a given path.

#### Parameters

##### path?

`string`

The path to query. It must end with a forward slash.

##### maxAge?

`number` \| `false`

(optional) Either `false` or the maximum age of cached
                listing in milliseconds. See [caching logic for read
                operations](#caching-logic-for-read-operations).

#### Returns

`Promise`\<`unknown`\>

A promise for a folder listing object

#### Example

```js
client.getListing().then(listing => console.log(listing));
```

The folder listing is returned as a JSON object, with the root keys
representing the pathnames of child nodes. Keys ending in a forward slash
represent _folder nodes_ (subdirectories), while all other keys represent
_data nodes_ (files/objects).

Data node information contains the item's ETag, content type and -length.

Example of a listing object:

```js
{
  "@context": "http://remotestorage.io/spec/folder-description",
  "items": {
    "thumbnails/": true,
    "screenshot-20170902-1913.png": {
      "ETag": "6749fcb9eef3f9e46bb537ed020aeece",
      "Content-Length": 53698,
      "Content-Type": "image/png;charset=binary"
    },
    "screenshot-20170823-0142.png": {
      "ETag": "92ab84792ef3f9e46bb537edac9bc3a1",
      "Content-Length": 412401,
      "Content-Type": "image/png;charset=binary"
    }
  }
}
```

> [!WARNING]
> At the moment, this function only returns detailed metadata, when
> caching is turned off. With caching turned on, it will only contain the
> item names as properties with `true` as value. See issues 721 and 1108 —
> contributions welcome!

***

### getObject()

> **getObject**(`path`, `maxAge?`): `Promise`\<`unknown`\>

Defined in: [baseclient.ts:537](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L537)

Get a JSON object from the given path.

#### Parameters

##### path

`string`

Relative path from the module root (without leading slash).

##### maxAge?

`number` \| `false`

(optional) Either `false` or the maximum age of
                cached object in milliseconds. See [caching logic for read
                operations](#caching-logic-for-read-operations).

#### Returns

`Promise`\<`unknown`\>

A promise, resolving with the requested object, or `null` if non-existent

#### Example

```ts
client.getObject('/path/to/object').then(obj => console.log(obj));
```

***

### on()

> **on**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:55](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/eventhandling.ts#L55)

Register an event handler for the given event name

Alias for [addEventListener](#addeventlistener)

#### Parameters

##### eventName

`string`

Name of the event

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

Function to handle the event

#### Returns

`void`

#### Example

```ts
remoteStorage.on('connected', function() {
  console.log('storage account has been connected');
});
```

***

### remove()

> **remove**(`path`): `Promise`\<`QueuedRequestResponse`\>

Defined in: [baseclient.ts:625](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L625)

Remove node at given path from storage. Triggers synchronization.

#### Parameters

##### path

`string`

Path relative to the module root.

#### Returns

`Promise`\<`QueuedRequestResponse`\>

#### Example

```ts
client.remove('path/to/object').then(() => console.log('item deleted'));
```

***

### removeEventListener()

> **removeEventListener**(`eventName`, `handler`): `void`

Defined in: [eventhandling.ts:62](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/eventhandling.ts#L62)

Remove a previously installed event handler

#### Parameters

##### eventName

`string`

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

***

### scope()

> **scope**(`path`): `BaseClient`

Defined in: [baseclient.ts:267](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L267)

Instantiate a new client, scoped to a subpath of the current client's
path.

#### Parameters

##### path

`string`

The path to scope the new client to

#### Returns

`BaseClient`

A new `BaseClient` operating on a subpath of the current base path

***

### storeFile()

> **storeFile**(`contentType`, `path`, `body`): `Promise`\<`string`\>

Defined in: [baseclient.ts:499](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L499)

Store raw data at a given path.

#### Parameters

##### contentType

`string`

Content type (MIME media type) of the data being stored

##### path

`string`

Path relative to the module root

##### body

`string` \| `ArrayBuffer` \| `ArrayBufferView`\<`ArrayBufferLike`\>

Raw data to store. For binary data, use an `ArrayBuffer`
                     or `ArrayBufferView` (e.g. `Uint8Array`), not a binary string.

#### Returns

`Promise`\<`string`\>

A promise for the created/updated revision (ETag)

#### Example

UTF-8 data:

```js
client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>')
      .then(() => { console.log("File saved") });
```

Binary data:

```js
const input = document.querySelector('form#upload input[type=file]');
const file = input.files[0];
const fileReader = new FileReader();

fileReader.onload = function () {
  client.storeFile(file.type, file.name, fileReader.result)
        .then(() => { console.log("File saved") });
};

fileReader.readAsArrayBuffer(file);
```

***

### storeObject()

> **storeObject**(`typeAlias`, `path`, `object`): `Promise`\<`string`\>

Defined in: [baseclient.ts:585](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L585)

Store an object at given path. Triggers synchronization. See [declareType](#declaretype) and
[Defining data types](../../../data-modules/defining-data-types)
for info on object types.

Must not be called more than once per second for any given `path`.

#### Parameters

##### typeAlias

`string`

Unique type of this object within this module.

##### path

`string`

Path relative to the module root.

##### object

`object`

A JavaScript object to be stored at the given path.
                   Must be serializable as JSON.

#### Returns

`Promise`\<`string`\>

Resolves with revision on success. Rejects with an error object,
         if schema validations fail.

#### Example

```ts
const bookmark = {
  url: 'http://unhosted.org',
  description: 'Unhosted Adventures',
  tags: ['unhosted', 'remotestorage', 'no-backend']
}
const path = MD5Hash(bookmark.url);

client.storeObject('bookmark', path, bookmark)
      .then(() => console.log('bookmark saved'))
      .catch((err) => console.log(err));
```

***

### validate()

> **validate**(`object`): `object`

Defined in: [baseclient.ts:761](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/baseclient.ts#L761)

Validate an object against the associated schema.

#### Parameters

##### object

JS object to validate. Must have a `@context` property.

#### Returns

`object`

An object containing information about the validation result

#### Example

```ts
var result = client.validate(document);

// result:
// {
//   error: null,
//   missing: [],
//   valid: true
// }
```
