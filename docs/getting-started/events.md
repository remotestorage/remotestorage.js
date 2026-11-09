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

A change event describes a data transition; it is not a database commit
notification. Likewise, `sync-done` reports the result of a sync cycle, not a
cross-client or durable-storage barrier. See [sync invariants and current
limits](../contributing/internals/sync-invariants) for details and tested ordering.

[1]: ../api/remotestorage/classes/RemoteStorage.html
[2]: ../api/baseclient/classes/BaseClient.html
