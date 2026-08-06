# Interface: Remote

Defined in: [remote.ts:78](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remote.ts#L78)

The public interface for WireClient, GoogleDrive & Dropbox

## Properties

### connected

> **connected**: `boolean`

Defined in: [remote.ts:82](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remote.ts#L82)

Whether or not a remote store is connected

***

### online

> **online**: `boolean`

Defined in: [remote.ts:87](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remote.ts#L87)

Whether last sync action was successful or not

***

### properties?

> `optional` **properties?**: `object`

Defined in: [remote.ts:123](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remote.ts#L123)

The JSON-parsed properties object from the user's WebFinger record

***

### userAddress

> **userAddress**: `string`

Defined in: [remote.ts:92](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remote.ts#L92)

The user address of the connected user
