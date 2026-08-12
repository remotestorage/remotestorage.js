# Interface: Remote

Defined in: [remote.ts:78](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L78)

The public interface for WireClient, GoogleDrive & Dropbox

## Properties

### connected

> **connected**: `boolean`

Defined in: [remote.ts:82](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L82)

Whether or not a remote store is connected

***

### online

> **online**: `boolean`

Defined in: [remote.ts:87](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L87)

Whether last sync action was successful or not

***

### properties?

> `optional` **properties?**: `object`

Defined in: [remote.ts:123](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L123)

The JSON-parsed properties object from the user's WebFinger record

***

### userAddress

> **userAddress**: `string`

Defined in: [remote.ts:92](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L92)

The user address of the connected user

## Methods

### getItemURL()?

> `optional` **getItemURL**(`path`): `Promise`\<`string`\>

Defined in: [remote.ts:173](https://github.com/remotestorage/remotestorage.js/blob/99feed53fb7138821307670428659d0d1b82ee1c/src/remote.ts#L173)

Retrieve full URL of a document. Required for cloud backends (Dropbox,
Google Drive) where the URL cannot be derived from the path alone.
For standard remoteStorage backends this can be omitted; BaseClient
will fall back to concatenating `href + path`.

#### Parameters

##### path

`string`

Absolute storage path (not module-relative)

#### Returns

`Promise`\<`string`\>
