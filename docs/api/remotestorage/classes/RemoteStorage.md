# Class: RemoteStorage

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
[on](RemoteStorage.md#on) function. For example:

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

### `wire-busy`

Emitted when a network request starts

### `wire-done`

Emitted when a network request completes

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

## Extends

- `EventHandling`

## Properties

### access

> **access**: [`Access`](../../access/classes/Access.md)

#### Defined in

[remotestorage.ts:295](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L295)

***

### backend

> **backend**: `"remotestorage"` \| `"googledrive"` \| `"dropbox"`

#### Defined in

[remotestorage.ts:326](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L326)

***

### caching

> **caching**: [`Caching`](../../caching/classes/Caching.md)

#### Defined in

[remotestorage.ts:301](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L301)

***

### remote

> **remote**: [`Remote`](../../remote/interfaces/Remote.md)

Depending on the chosen backend, this is either an instance of `WireClient`,
`Dropbox` or `GoogleDrive`.

See [Remote](../../remote/interfaces/Remote.md) for public API

#### Example

```ts
remoteStorage.remote.connected
// false
```

#### Defined in

[remotestorage.ts:338](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L338)

***

### sync

> **sync**: `Sync`

#### Defined in

[remotestorage.ts:298](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L298)

## Accessors

### connected

> `get` **connected**(): `boolean`

Indicating if remoteStorage is currently connected.

#### Returns

`boolean`

#### Defined in

[remotestorage.ts:441](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L441)

## Methods

### addEventListener()

> **addEventListener**(`eventName`, `handler`): `void`

Install an event handler for the given event name

Usually called via [`on()`](#on)

#### Parameters

• **eventName**: `string`

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Defined in

[eventhandling.ts:29](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/eventhandling.ts#L29)

***

### addModule()

> **addModule**(`module`): `void`

Add remoteStorage data module

#### Parameters

• **module**: [`RSModule`](../interfaces/RSModule.md)

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

#### Defined in

[remotestorage.ts:1189](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1189)

***

### connect()

> **connect**(`userAddress`, `token`?): `void`

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

• **userAddress**: `string`

The user address (user@host) or URL to connect to.

• **token?**: `string`

(optional) A bearer token acquired beforehand

#### Returns

`void`

#### Example

```ts
remoteStorage.connect('user@example.com');
```

#### Defined in

[remotestorage.ts:543](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L543)

***

### disableLog()

> **disableLog**(): `void`

Disable remoteStorage debug logging

#### Returns

`void`

#### Defined in

[remotestorage.ts:727](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L727)

***

### disconnect()

> **disconnect**(): `void`

"Disconnect" from remote server to terminate current session.

This method clears all stored settings and deletes the entire local
cache.

#### Returns

`void`

#### Defined in

[remotestorage.ts:629](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L629)

***

### enableLog()

> **enableLog**(): `void`

Enable remoteStorage debug logging.

Usually done when instantiating remoteStorage:

```js
const remoteStorage = new RemoteStorage({ logging: true });
```

#### Returns

`void`

#### Defined in

[remotestorage.ts:720](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L720)

***

### getBackgroundSyncInterval()

> **getBackgroundSyncInterval**(): `number`

Get the value of the sync interval when application is in the background

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getBackgroundSyncInterval();
// 60000
```

#### Defined in

[remotestorage.ts:1024](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1024)

***

### getCurrentSyncInterval()

> **getCurrentSyncInterval**(): `number`

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

#### Defined in

[remotestorage.ts:1060](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1060)

***

### getRequestTimeout()

> **getRequestTimeout**(): `number`

Get the value of the current network request timeout

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getRequestTimeout();
// 30000
```

#### Defined in

[remotestorage.ts:1073](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1073)

***

### getSyncInterval()

> **getSyncInterval**(): `number`

Get the value of the sync interval when application is in the foreground

#### Returns

`number`

A number of milliseconds

#### Example

```ts
remoteStorage.getSyncInterval();
// 10000
```

#### Defined in

[remotestorage.ts:990](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L990)

***

### on()

> **on**(`eventName`, `handler`): `void`

Register an event handler for the given event name

Alias for [addEventListener](RemoteStorage.md#addeventlistener)

#### Parameters

• **eventName**: `string`

Name of the event

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

Function to handle the event

#### Returns

`void`

#### Example

```ts
remoteStorage.on('connected', function() {
  console.log('storage account has been connected');
});
```

#### Defined in

[eventhandling.ts:55](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/eventhandling.ts#L55)

***

### onChange()

> **onChange**(`path`, `handler`): `void`

Add a `change` event handler for the given path. Whenever a change
happens (as determined by the local backend, such as e.g.
`RemoteStorage.IndexedDB`), and the affected path is equal to or below the
given 'path', the given handler is called.

> [!TIP]
> You should usually not use this method, but instead use the
> `change` events provided by [BaseClient](../../baseclient/classes/BaseClient.md).

#### Parameters

• **path**: `string`

Absolute path to attach handler to

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

A function to handle the change

#### Returns

`void`

#### Example

```ts
remoteStorage.onChange('/bookmarks/', function() {
  // your code here
})
```

#### Defined in

[remotestorage.ts:704](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L704)

***

### reconnect()

> **reconnect**(): `void`

Reconnect the remote server to get a new authorization.

Useful when not using the connect widget and encountering an
`Unauthorized` event.

#### Returns

`void`

#### Defined in

[remotestorage.ts:613](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L613)

***

### removeEventListener()

> **removeEventListener**(`eventName`, `handler`): `void`

Remove a previously installed event handler

#### Parameters

• **eventName**: `string`

• **handler**: [`EventHandler`](../../eventhandling/type-aliases/EventHandler.md)

#### Returns

`void`

#### Defined in

[eventhandling.ts:62](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/eventhandling.ts#L62)

***

### scope()

> **scope**(`path`): [`BaseClient`](../../baseclient/classes/BaseClient.md)

This method allows you to quickly instantiate a BaseClient, which you can
use to directly read and manipulate data in the connected storage account.

Please use this method only for debugging and development, and choose or
create a [data module](../../../data-modules/) for your app to use.

#### Parameters

• **path**: `string`

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

#### Defined in

[remotestorage.ts:971](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L971)

***

### setApiKeys()

> **setApiKeys**(`apiKeys`): `boolean` \| `void`

Set the OAuth key/ID for GoogleDrive and/or Dropbox backend support.

#### Parameters

• **apiKeys**

A config object

• **apiKeys.dropbox**: `string`

• **apiKeys.googledrive**: `string`

#### Returns

`boolean` \| `void`

#### Example

```ts
remoteStorage.setApiKeys({
  dropbox: 'your-app-key',
  googledrive: 'your-client-id'
});
```

#### Defined in

[remotestorage.ts:751](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L751)

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

#### Example

```ts
remoteStorage.setBackgroundSyncInterval(90000);
```

#### Defined in

[remotestorage.ts:1037](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1037)

***

### setCordovaRedirectUri()

> **setCordovaRedirectUri**(`uri`): `void`

Set redirect URI to be used for the OAuth redirect within the
in-app-browser window in Cordova apps. See
[Usage in Cordova apps](../../../cordova) for details.

#### Parameters

• **uri**: `string`

A valid HTTP(S) URI

#### Returns

`void`

#### Example

```ts
remoteStorage.setCordovaRedirectUri('https://app.example.com');
```

#### Defined in

[remotestorage.ts:797](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L797)

***

### setRequestTimeout()

> **setRequestTimeout**(`timeout`): `void`

Set the timeout for network requests.

#### Parameters

• **timeout**: `number`

Timeout in milliseconds

#### Returns

`void`

#### Example

```ts
remoteStorage.setRequestTimeout(30000);
```

#### Defined in

[remotestorage.ts:1085](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1085)

***

### setSyncInterval()

> **setSyncInterval**(`interval`): `void`

Set the value of the sync interval when application is in the foreground

#### Parameters

• **interval**: `number`

Sync interval in milliseconds (between 2000 and 3600000 [1 hour])

#### Returns

`void`

#### Example

```ts
remoteStorage.setSyncInterval(20000);
```

#### Defined in

[remotestorage.ts:1002](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1002)

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

#### Defined in

[remotestorage.ts:1126](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1126)

***

### stopSync()

> **stopSync**(): `void`

Stop the periodic synchronization.

#### Returns

`void`

#### Defined in

[remotestorage.ts:1139](https://github.com/remotestorage/remotestorage.js/blob/a199c15fb409a17fd444aa7fba846e7fecc5981d/src/remotestorage.ts#L1139)
