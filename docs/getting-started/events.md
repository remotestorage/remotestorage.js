# Handling events

In order to get informed about users connecting their storage, data
being transferred, the library going into offline mode, errors being
thrown, and other such things, you can listen to the events emitted by
the [RemoteStorage][1] instance, as well as [BaseClient][2] instances.

Simply register your event handler functions using the `.on()` method,
like so:

```js
remoteStorage.on('connected', () => {
  const userAddress = remoteStorage.remote.userAddress;
  console.debug(`${userAddress} connected their remote storage.`);
})

remoteStorage.on('network-offline', () => {
  console.debug(`We're offline now.`);
})

remoteStorage.on('network-online', () => {
  console.debug(`Hooray, we're back online.`);
})
```

Check out the [RemoteStorage API][1] reference for a complete list of events
and when they're emitted.

Also see *change events* in the [BaseClient API][2] reference, which you can
use to handle incoming data and changes from the remote storage server.

## Change events vs. sync events

remoteStorage.js has two different event systems that serve different purposes:

**`change` events** (on [BaseClient][2]) fire once per item when data is
created, updated, or deleted — whether from a local write, a remote sync, or
another browser tab. These are the primary way to keep your UI in sync with
data. See [Loading data](./loading-data) for patterns on using them.

**`sync-done`** (on [RemoteStorage][1]) fires when a sync cycle completes.
It is a lifecycle signal, not a data-change signal — it fires every cycle,
including idle ones where nothing changed. It is useful as a batch boundary
(e.g. "reload once after all incoming changes have been processed") but
should not be used as the sole indicator that data has changed.

::: tip
Use `change` events to know *what* changed. Use `sync-done` to know *when
the sync cycle finished*. See [Handling bulk incoming
changes](./loading-data#handling-bulk-incoming-changes) for a pattern that
combines both.
:::

[1]: ../api/remotestorage/classes/RemoteStorage.html
[2]: ../api/baseclient/classes/BaseClient.html
