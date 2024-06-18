# Class: RemoteStorage

Constructor for the remoteStorage object/instance

This class primarily contains feature detection code and convenience API.

Depending on which features are built in, it contains different attributes
and functions. See the individual features for more information.

## Param

an optional configuration object

## Extends

- `EventHandling`

## Methods

### connect()

> **connect**(`userAddress`, `token`?): `void`

Connect to a remoteStorage server.

Discovers the WebFinger profile of the given user address and initiates
the OAuth dance.

This method must be called *after* all required access has been claimed.
When using the connect widget, it will call this method itself.

Special cases:

1. If a bearer token is supplied as second argument, the OAuth dance
   will be skipped and the supplied token be used instead. This is
   useful outside of browser environments, where the token has been
   acquired in a different way.

2. If the Webfinger profile for the given user address doesn't contain
   an auth URL, the library will assume that client and server have
   established authorization among themselves, which will omit bearer
   tokens in all requests later on. This is useful for example when using
   Kerberos and similar protocols.

#### Parameters

• **userAddress**: `string`

The user address (user@host) or URL to connect to.

• **token?**: `string`

(optional) A bearer token acquired beforehand

#### Returns

`void`

#### Source

[remotestorage.ts:377](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L377)

***

### disableLog()

> **disableLog**(): `void`

TODO: do we still need this, now that we always instantiate the prototype?

Disable remoteStorage logging

#### Returns

`void`

#### Source

[remotestorage.ts:550](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L550)

***

### disconnect()

> **disconnect**(): `void`

"Disconnect" from remote server to terminate current session.

This method clears all stored settings and deletes the entire local
cache.

#### Returns

`void`

#### Source

[remotestorage.ts:460](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L460)

***

### enableLog()

> **enableLog**(): `void`

TODO: do we still need this, now that we always instantiate the prototype?

Enable remoteStorage logging.

#### Returns

`void`

#### Source

[remotestorage.ts:541](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L541)

***

### getBackgroundSyncInterval()

> **getBackgroundSyncInterval**(): `number`

Get the value of the sync interval when application is in the background

#### Returns

`number`

A number of milliseconds

#### Source

[remotestorage.ts:820](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L820)

***

### getCurrentSyncInterval()

> **getCurrentSyncInterval**(): `number`

Get the value of the current sync interval. Can be background or
foreground, custom or default.

#### Returns

`number`

A number of milliseconds

#### Source

[remotestorage.ts:845](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L845)

***

### getRequestTimeout()

> **getRequestTimeout**(): `number`

Get the value of the current network request timeout

#### Returns

`number`

A number of milliseconds

#### Source

[remotestorage.ts:854](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L854)

***

### getSyncInterval()

> **getSyncInterval**(): `number`

Get the value of the sync interval when application is in the foreground

#### Returns

`number`

A number of milliseconds

#### Source

[remotestorage.ts:797](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L797)

***

### log()

> **log**(...`args`): `void`

log

The same as <RemoteStorage.log>.

#### Parameters

• ...**args**: `any`[]

#### Returns

`void`

#### Source

[remotestorage.ts:559](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L559)

***

### onChange()

> **onChange**(`path`, `handler`): `void`

Add a "change" event handler to the given path. Whenever a "change"
happens (as determined by the backend, such as e.g.
<RemoteStorage.IndexedDB>) and the affected path is equal to or below the
given 'path', the given handler is called.

You should usually not use this method directly, but instead use the
"change" events provided by :doc:`BaseClient </js-api/base-client>`

#### Parameters

• **path**: `string`

Absolute path to attach handler to

• **handler**: `any`

Handler function

#### Returns

`void`

#### Source

[remotestorage.ts:529](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L529)

***

### reconnect()

> **reconnect**(): `void`

Reconnect the remote server to get a new authorization.

#### Returns

`void`

#### Source

[remotestorage.ts:444](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L444)

***

### scope()

> **scope**(`path`): [`BaseClient`](../../baseclient/classes/BaseClient.md)

This method enables you to quickly instantiate a BaseClient, which you can
use to directly read and manipulate data in the connected storage account.

Please use this method only for debugging and development, and choose or
create a :doc:`data module </data-modules>` for your app to use.

#### Parameters

• **path**: `string`

The base directory of the BaseClient that will be returned
              (with a leading and a trailing slash)

#### Returns

[`BaseClient`](../../baseclient/classes/BaseClient.md)

A client with the specified scope (category/base directory)

#### Source

[remotestorage.ts:782](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L782)

***

### setApiKeys()

> **setApiKeys**(`apiKeys`): `boolean` \| `void`

Set the OAuth key/ID for either GoogleDrive or Dropbox backend support.

#### Parameters

• **apiKeys**

A config object with these properties:

• **apiKeys.dropbox**: `string`

• **apiKeys.googledrive**: `string`

#### Returns

`boolean` \| `void`

#### Source

[remotestorage.ts:570](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L570)

***

### setBackgroundSyncInterval()

> **setBackgroundSyncInterval**(`interval`): `void`

Set the value of the sync interval when the application is in the
background

#### Parameters

• **interval**: `number`

Sync interval in milliseconds (between 2000 and 3600000 [1 hour])

#### Returns

`void`

#### Source

[remotestorage.ts:830](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L830)

***

### setCordovaRedirectUri()

> **setCordovaRedirectUri**(`uri`): `void`

Set redirect URI to be used for the OAuth redirect within the
in-app-browser window in Cordova apps.

#### Parameters

• **uri**: `string`

A valid HTTP(S) URI

#### Returns

`void`

#### Source

[remotestorage.ts:612](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L612)

***

### setRequestTimeout()

> **setRequestTimeout**(`timeout`): `void`

Set the timeout for network requests.

#### Parameters

• **timeout**: `number`

Timeout in milliseconds

#### Returns

`void`

#### Source

[remotestorage.ts:863](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L863)

***

### setSyncInterval()

> **setSyncInterval**(`interval`): `void`

Set the value of the sync interval when application is in the foreground

#### Parameters

• **interval**: `number`

Sync interval in milliseconds (between 2000 and 3600000 [1 hour])

#### Returns

`void`

#### Source

[remotestorage.ts:806](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L806)

***

### startSync()

> **startSync**(): `Promise`\<`void`\>

Start synchronization with remote storage, downloading and uploading any
changes within the cached paths.

Please consider: local changes will attempt sync immediately, and remote
changes should also be synced timely when using library defaults. So
this is mostly useful for letting users sync manually, when pressing a
sync button for example. This might feel safer to them sometimes, esp.
when shifting between offline and online a lot.

#### Returns

`Promise`\<`void`\>

A Promise which resolves when the sync has finished

#### Source

[remotestorage.ts:904](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L904)

***

### stopSync()

> **stopSync**(): `void`

Stop the periodic synchronization.

#### Returns

`void`

#### Source

[remotestorage.ts:917](https://github.com/remotestorage/remotestorage.js/blob/9b126479fa187d3d9af88a42c7c271be1fd71c06/src/remotestorage.ts#L917)
