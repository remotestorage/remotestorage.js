Handling events
===============

In order to get informed about users connecting their storage, data being
transferred, the library going into offline mode, errors being thrown, and
other such things, you can listen to the events emitted by the
``RemoteStorage`` instance, as well as ``BaseClient`` instances.

Simply register your event handler functions using the ``.on()`` method, like
so::

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

Check out the :doc:`RemoteStorage API doc</js-api/remotestorage>` for a
complete list of events and when exacty they are emitted.

Also check out *Change events* in the :doc:`BaseClient API
doc</js-api/base-client>`, which you can use to handle incoming data and
changes from the remote storage.

