# Class: RemoteStorage

Defined in: [remotestorage.ts:323](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L323)

Create a `remoteStorage` class instance so:

```js
const remoteStorage = new RemoteStorage();
```

The constructor can optionally be called with a configuration object. This
example shows all default values:

```js
const remoteStorage = new RemoteStorage({
  cache: true,
  changeEvents: {
    local:    true,
    window:   false,
    remote:   true,
    conflict: true
  },
  cordovaRedirectUri: undefined,
  logging: false,
  modules: []
});
```

> [!NOTE]
> In the current version, it is only possible to use a single `remoteStorage`
> instance. You cannot connect to two different remotes in parallel yet.
> We intend to support this eventually.

> [!TIP]
> For the change events configuration, you have to set all events
> explicitly.  Otherwise it disables the unspecified ones.

## Events

You can add event handlers to your `remoteStorage` instance by using the
[on](#on) function. For example:

```js
remoteStorage.on('connected', function() {
  // Storage account has been connected, let’s roll!
});
```

### `ready`

Emitted when all features are loaded and the RS instance is ready to be used
in your app

### `not-connected`

Emitted when ready, but no storage connected ("anonymous mode")

> [!NOTE]
> In non-browser environments, this will always be emitted (before any
> potential `connected` events after)

### `connected`

Emitted when a remote storage has been connected

### `disconnected`

Emitted after disconnect

### `error`

Emitted when an error occurs; receives an error object as argument

There are a handful of known errors, which are identified by the `name`
property of the error object:

* `Unauthorized`

  Emitted when a network request resulted in a 401 or 403 response. You can
  use this event to handle invalid OAuth tokens in custom UI (i.e. when a
  stored token has been revoked or expired by the RS server).

* `DiscoveryError`

  A variety of storage discovery errors, e.g. from user address input
  validation, or user address lookup issues

#### Example

```js
remoteStorage.on('error', err => console.log(err));

// {
//   name: "Unauthorized",
//   message: "App authorization expired or revoked.",
//   stack: "Error↵  at new a.Unauthorized (vendor.js:65710:41870)"
// }
```

### `connecting`

Emitted before webfinger lookup

### `authing`

Emitted before redirecting to the OAuth server

### `scope-change-required`

Emitted when the currently claimed access scopes differ from the last
authorized scope stored in localStorage. The callback receives an object
containing the previously authorized scope, the currently requested scope,
and a `reauthorize()` helper.

### `wire-busy`

Emitted when a network request starts

### `wire-done`

Emitted when a network request completes

### `sync-started`

Emitted when a sync procedure has started.

### `sync-req-done`

Emitted when a single sync request has finished. Callback functions
receive an object as argument, informing the client of remaining items
in the current sync task queue.

#### Example

```js
remoteStorage.on('sync-req-done', result => console.log(result));
// { tasksRemaining: 21 }
```

> [!NOTE]
> The internal task queue holds at most 100 items at the same time,
> regardless of the overall amount of items to sync. Therefore, this number
> is only an indicator of sync status, not a precise amount of items left
> to sync. It can be useful to determine if your app should display any
> kind of sync status/progress information for the cycle or not.

### `sync-done`

Emitted when a sync cycle has been completed and a new sync is scheduled.

The callback function receives an object as argument, informing the client
if the sync process has completed successfully or not.

#### Example

```js
remoteStorage.on('sync-done', result => console.log(result));
// { completed: true }
```

If `completed` is `false`, it means that some of the sync requests have
failed and will be retried in the next sync cycle (usually a few seconds
later in this case). This is not an unusual scenario on mobile networks or
when doing a large initial sync for example.

For an app's user interface, you may want to consider the sync process as
ongoing in this case, and wait until your app sees a positive `completed`
status before updating the UI.

### `network-offline`

Emitted once when a wire request fails for the first time, and
`remote.online` is set to false

### `network-online`

Emitted once when a wire request succeeds for the first time after a failed
one, and `remote.online` is set back to true

### `sync-interval-change`

Emitted when the sync interval changes

## Properties

### access

> **access**: [`Access`](../../access/classes/Access.md)

Defined in: [remotestorage.ts:351](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L351)

Managing claimed access scopes

***

### backend?

> `optional` **backend?**: `"remotestorage"` \| `"dropbox"` \| `"googledrive"`

Defined in: [remotestorage.ts:386](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L386)

***

### caching

> **caching**: [`Caching`](../../caching/classes/Caching.md)

Defined in: [remotestorage.ts:356](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L356)

Managing cache settings

***

### remote

> **remote**: [`Remote`](../../remote/interfaces/Remote.md)

Defined in: [remotestorage.ts:398](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L398)

Depending on the chosen backend, this is either an instance of `WireClient`,
`Dropbox` or `GoogleDrive`.

See [Remote](../../remote/interfaces/Remote.md) for public API

#### Example

```ts
remoteStorage.remote.connected
// false
```

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

Defined in: [remotestorage.ts:523](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L523)

Indicating if remoteStorage is currently connected.

##### Returns

`boolean`

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

### addModule()

> **addModule**(`module`): `void`

Defined in: [remotestorage.ts:1402](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1402)

Add remoteStorage data module

#### Parameters

##### module

[`RSModule`](../interfaces/RSModule.md)

A data module object

#### Returns

`void`

#### Example

Usually, you will import your data module from either a package or a local path.
Let's say you want to use the
[bookmarks module](https://github.com/raucao/remotestorage-module-bookmarks)
in order to load data stored from [Webmarks](https://webmarks.5apps.com) for
example:

```js
import Bookmarks from 'remotestorage-module-bookmarks';

remoteStorage.addModule(Bookmarks);
```

You can also forgo this function entirely and add modules when creating your
remoteStorage instance:

```js
const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });
```

After the module has been added, it can be used like so:

```js
remoteStorage.bookmarks.archive.getAll(false)
  .then(bookmarks => console.log(bookmarks));
```

***

### connect()

> **connect**(`userAddress`, `token?`): `void`

Defined in: [remotestorage.ts:622](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L622)

Connect to a remoteStorage server.

Discovers the WebFinger profile of the given user address and initiates
the OAuth dance.

This method must be called *after* all required access has been claimed.
When using the connect widget, it will call this method when the user
clicks/taps the "connect" button.

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

##### userAddress

`string`

The user address (user@host) or URL to connect to.

##### token?

`string`

(optional) A bearer token acquired beforehand

#### Returns

`void`

#### Example

```ts
remoteStorage.connect('user@example.com');
```

***

### disableLog()

> **disableLog**(): `void`

Defined in: [remotestorage.ts:942](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L942)

Disable remoteStorage debug logging

#### Returns

`void`

***

### disconnect()

> **disconnect**(): `void`

Defined in: [remotestorage.ts:710](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L710)

"Disconnect" from remote server to terminate current session.

This method clears all stored settings and deletes the entire local
cache.

#### Returns

`void`

***

### enableLog()

> **enableLog**(): `void`

Defined in: [remotestorage.ts:935](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L935)

Enable remoteStorage debug logging.

Usually done when instantiating remoteStorage:

```js
const remoteStorage = new RemoteStorage({ logging: true });
```

#### Returns

`void`

***

### getBackgroundSyncInterval()

> **getBackgroundSyncInterval**(): `number`

Defined in: [remotestorage.ts:1239](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1239)

Get the value of the sync interval when application is in the background

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getBackgroundSyncInterval();
// 60000
```

***

### getCurrentSyncInterval()

> **getCurrentSyncInterval**(): `number`

Defined in: [remotestorage.ts:1275](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1275)

Get the value of the current sync interval. Can be background or
foreground, custom or default.

#### Returns

`number`

number of milliseconds

#### Example

```ts
remoteStorage.getCurrentSyncInterval();
// 15000
```

***

### getRequestTimeout()

> **getRequestTimeout**(): `number`

Defined in: [remotestorage.ts:1288](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1288)

Get the value of the current network request timeout

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getRequestTimeout();
// 30000
```

***

### getSyncInterval()

> **getSyncInterval**(): `number`

Defined in: [remotestorage.ts:1205](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1205)

Get the value of the sync interval when application is in the foreground

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getSyncInterval();
// 10000
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

### onChange()

> **onChange**(`path`, `handler`): `void`

Defined in: [remotestorage.ts:919](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L919)

Add a `change` event handler for the given path. Whenever a change
happens (as determined by the local backend, such as e.g.
`RemoteStorage.IndexedDB`), and the affected path is equal to or below the
given 'path', the given handler is called.

> [!TIP]
> You should usually not use this method, but instead use the
> `change` events provided by [BaseClient](../../baseclient/classes/BaseClient.md).

#### Parameters

##### path

`string`

Absolute path to attach handler to

##### handler

[`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

A function to handle the change

#### Returns

`void`

#### Example

```ts
remoteStorage.onChange('/bookmarks/', function() {
  // your code here
})
```

***

### reauthorize()

> **reauthorize**(): `void`

Defined in: [remotestorage.ts:700](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L700)

Alias for [reconnect](#reconnect), intended for permission refresh flows.

#### Returns

`void`

***

### reconnect()

> **reconnect**(): `void`

Defined in: [remotestorage.ts:687](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L687)

Reconnect the remote server to get a new authorization.

Useful when not using the connect widget and encountering an
`Unauthorized` event.

#### Returns

`void`

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

> **scope**(`path`): [`BaseClient`](../../baseclient/classes/BaseClient.md)

Defined in: [remotestorage.ts:1186](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1186)

This method allows you to quickly instantiate a BaseClient, which you can
use to directly read and manipulate data in the connected storage account.

Please use this method only for debugging and development, and choose or
create a [data module](../../../data-modules/) for your app to use.

#### Parameters

##### path

`string`

The base directory of the BaseClient that will be returned
              (with a leading and a trailing slash)

#### Returns

[`BaseClient`](../../baseclient/classes/BaseClient.md)

A client with the specified scope (category/base directory)

#### Example

```ts
remoteStorage.scope('/pictures/').getListing('');
remoteStorage.scope('/public/pictures/').getListing('');
```

***

### setApiKeys()

> **setApiKeys**(`apiKeys`): `boolean` \| `void`

Defined in: [remotestorage.ts:966](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L966)

Set the OAuth key/ID for GoogleDrive and/or Dropbox backend support.

#### Parameters

##### apiKeys

A config object

###### dropbox?

`string`

###### googledrive?

`string`

#### Returns

`boolean` \| `void`

#### Example

```ts
remoteStorage.setApiKeys({
  dropbox: 'your-app-key',
  googledrive: 'your-client-id'
});
```

***

### setBackgroundSyncInterval()

> **setBackgroundSyncInterval**(`interval`): `void`

Defined in: [remotestorage.ts:1252](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1252)

Set the value of the sync interval when the application is in the
background

#### Parameters

##### interval

`number`

Sync interval in milliseconds (between 2000 and 3600000 [1 hour])

#### Returns

`void`

#### Example

```ts
remoteStorage.setBackgroundSyncInterval(90000);
```

***

### setCordovaRedirectUri()

> **setCordovaRedirectUri**(`uri`): `void`

Defined in: [remotestorage.ts:1012](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1012)

Set redirect URI to be used for the OAuth redirect within the
in-app-browser window in Cordova apps. See
[Usage in Cordova apps](../../../cordova) for details.

#### Parameters

##### uri

`string`

A valid HTTP(S) URI

#### Returns

`void`

#### Example

```ts
remoteStorage.setCordovaRedirectUri('https://app.example.com');
```

***

### setRequestTimeout()

> **setRequestTimeout**(`timeout`): `void`

Defined in: [remotestorage.ts:1300](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1300)

Set the timeout for network requests.

#### Parameters

##### timeout

`number`

Timeout in milliseconds

#### Returns

`void`

#### Example

```ts
remoteStorage.setRequestTimeout(30000);
```

***

### setSyncInterval()

> **setSyncInterval**(`interval`): `void`

Defined in: [remotestorage.ts:1217](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1217)

Set the value of the sync interval when application is in the foreground

#### Parameters

##### interval

`number`

Sync interval in milliseconds (between 2000 and 3600000 [1 hour])

#### Returns

`void`

#### Example

```ts
remoteStorage.setSyncInterval(20000);
```

***

### startSync()

> **startSync**(): `Promise`\<`void`\>

Defined in: [remotestorage.ts:1341](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1341)

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

***

### stopSync()

> **stopSync**(): `void`

Defined in: [remotestorage.ts:1354](https://github.com/remotestorage/remotestorage.js/blob/ecf411704035df8269e5e37a88972943096bb455/src/remotestorage.ts#L1354)

Stop the periodic synchronization.

#### Returns

`void`
