
Caching in remotestorage.js
===========================

remotestorage.js gives you the option to synchronize some or all of the remote data your app has access to, to a local database. Usually this database is a indexedDB.

Enabling caching has several benefits and drawbacks:
* Speed of access: locally cached data is available to the app a lot faster.
* Offline mode: when data is cached, it can be read, written and removed while offline. Once the connection to the remotestorage provider is re-established, the pending changes will be synchronized.
* Initial synchronization time: the amount of data your app caches can have a significant impact on startup time of your app. If your app deals with large data items, you may want to consider synchronizing the big parts of the data only when the user wants to access them.

Caching can be enabled on a per-path basis. When caching is enabled for a given folder, that causes all subdirectories to be cached as well.

There are two ways to configure caching:
* globally through `remoteStorage.caching` - this would usually be done by an app.
* locally through `BaseClient#cache` - this would usually be done by a module.

Configuring caching from a module
---------------------------------

# WARNING: Make sure you never combine cache control with remoteStorage.claimAccess, but always with remoteStorage.access.claim instead, see https://github.com/remotestorage/remotestorage.js/issues/380#issuecomment-22217969

The `BaseClient#cache` interface is only a convenience method that internally uses `remoteStorage.caching`.

This example shows how to configure caching in a module:
```javascript
RemoteStorage.defineModule('beers', function(privateClient, publicClient) {
  var pilsener = privateClient.scope('pilsener/');

  // these two are equivalent operations:
  privateClient.cache('pilsener/');
  // OR:
  pilsener.cache();

  // to disable caching for a given path, pass 'false' as the second argument:
  privateClient.cache('pilsener/', false);
  // OR:
  pilsener.cache('', false);

  return {
    exports: {
      pilsener: pilsener
    }
  };
});
```

Configuring caching from elsewhere
----------------------------------

If you want to alter caching settings outside of a module's context, you can do so using the `remoteStorage.caching` interface.

This example shows how to do that:
```javascript

remoteStorage.caching.enable('/beers/pilsener/');

remoteStorage.caching.disable('/beers/pilsener/');

```

Synchronizing after caching settings have changed
-------------------------------------------------


Whenever you have changed the caching settings, you can either wait for the next automatic synchronization to happen, or trigger one yourself:

```javascript

remoteStorage.sync().then(function() {
  console.log("Synchronization finished.");
});

```
