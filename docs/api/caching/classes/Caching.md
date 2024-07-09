# Class: Caching

The caching class gets initialized as `remoteStorage.caching`, unless the
[RemoteStorage](../../remotestorage/classes/RemoteStorage.md) instance is created with the option `cache: false`, disabling
caching entirely.

In case your app hasn't explictly configured caching, the default setting is to
cache any documents that have been either created or requested since your app
loaded. For offline-capable apps, it usually makes sense to enable full,
automatic caching of all documents, which is what [enable](Caching.md#enable) will do.

Enabling full caching has several benefits:

* Speed of access: locally cached data is available to the app a lot faster.
* Offline mode: when all data is cached, it can also be read when your app
  starts while being offline.
* Initial synchronization time: the amount of data your app caches can
  have a significant impact on its startup time.

Caching can be configured on a per-path basis. When caching is enabled for a
folder, it causes all subdirectories to be cached as well.

## Caching strategies

For each subtree, you can set the caching strategy to ``ALL``, ``SEEN``
(default), and ``FLUSH``.

* `ALL` means that once all outgoing changes have been pushed, sync will
  start retrieving nodes to cache pro-actively. If a local copy exists
  of everything, it will check on each sync whether the ETag of the root
  folder changed, and retrieve remote changes if they exist.
* `SEEN` does this only for documents and folders that have been either
  read from or written to at least once since connecting to the current
  remote backend, plus their parent/ancestor folders up to the root (to
  make tree-based sync possible).
* `FLUSH` will only cache outgoing changes, and forget them as soon as
  they have been saved to remote successfully.

## Methods

### checkPath()

> **checkPath**(`path`): `string`

Retrieve caching setting for a given path, or its next parent
with a caching strategy set.

#### Parameters

• **path**: `string`

Path to retrieve setting for

#### Returns

`string`

caching strategy for the path

#### Example

```js
remoteStorage.caching.checkPath('documents/').then(strategy => {
  console.log(`caching strategy for 'documents/': ${strategy}`));
  // "caching strategy for 'documents/': SEEN"
});
```

#### Source

[caching.ts:157](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L157)

***

### disable()

> **disable**(`path`): `void`

Disable caching for a given path.

Uses caching strategy ``FLUSH`` (meaning items are only cached until
successfully pushed to the remote).

#### Parameters

• **path**: `string`

Path to disable caching for

#### Returns

`void`

#### Example

```js
remoteStorage.caching.disable('/bookmarks/');
```

#### Source

[caching.ts:124](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L124)

***

### enable()

> **enable**(`path`): `void`

Enable caching for a given path.

Uses caching strategy ``ALL``.

#### Parameters

• **path**: `string`

Path to enable caching for

#### Returns

`void`

#### Example

```js
remoteStorage.caching.enable('/bookmarks/');
```

#### Source

[caching.ts:107](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L107)

***

### onActivate()

> **onActivate**(`cb`): `void`

Set a callback for when caching is activated for a path.

#### Parameters

• **cb**

Callback function

#### Returns

`void`

#### Source

[caching.ts:133](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L133)

***

### reset()

> **reset**(): `void`

Reset the state of caching by deleting all caching information.

#### Returns

`void`

#### Example

```js
remoteStorage.caching.reset();
```

#### Source

[caching.ts:175](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L175)

***

### set()

> **set**(`path`, `strategy`): `void`

Configure caching for a given path explicitly.

Not needed when using ``enable``/``disable``.

#### Parameters

• **path**: `string`

Path to cache

• **strategy**: `"ALL"` \| `"SEEN"` \| `"FLUSH"`

Caching strategy. One of 'ALL', 'SEEN', or 'FLUSH'.

#### Returns

`void`

#### Example

```js
remoteStorage.caching.set('/bookmarks/archive/', 'SEEN');
```

#### Source

[caching.ts:67](https://github.com/remotestorage/remotestorage.js/blob/65f5343823175e12058c01e23219a8cc9d34932b/src/caching.ts#L67)
