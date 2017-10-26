Caching
=======

remoteStorage.js gives you the option to synchronize some or all of the
remote data your app has access to, to a local store. Usually this store
is an IndexedDB database.

The caching class gets initialized as ``remoteStorage.caching``, unless the
:doc:`RemoteStorage </js-api/remotestorage>` instance is created with the
option ``caching: false``.

Enabling caching has several benefits and drawbacks:

* Speed of access: locally cached data is available to the app a lot faster.
* Offline mode: when data is cached, it can be read, written and removed
  while offline or not connected to any remote storage. Once the
  connection to the remoteStorage provider is (re-)established, the
  pending changes will be synchronized.
* Initial synchronization time: the amount of data your app caches can
  have a significant impact on startup time of your app. If your app
  deals with large data items, you may want to consider synchronizing
  the big parts of the data only when the user wants to access them.

Caching can be enabled on a per-path basis. When caching is enabled for
a given folder, that causes all subdirectories to be cached as well.

.. _caching-strategies:

Caching strategies
------------------

For each subtree, you can set the caching strategy to ``ALL``, ``SEEN``
(default), and ``FLUSH``.

* ``ALL`` means that once all outgoing changes have been pushed, sync will
  start retrieving nodes to cache pro-actively. If a local copy exists
  of everything, it will check on each sync whether the ETag of the root
  folder changed, and retrieve remote changes if they exist.
* ``SEEN`` does this only for documents and folders that have been either
  read from or written to at least once since connecting to the current
  remote backend, plus their parent/ancestor folders up to the root (to
  make tree-based sync possible).
* ``FLUSH`` will only cache outgoing changes, and forget them as soon as
  they have been saved to remote successfully.

Synchronizing after caching settings have changed
-------------------------------------------------

Whenever you have changed the caching settings, you can either wait for
the next automatic synchronization to happen, or trigger one yourself:

.. code:: javascript

   remoteStorage.startSync().then(function() {
     console.log("Synchronization finished.");
   });


List of functions
-------------------

.. autofunction:: Caching#enable(path)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.enable('/bookmarks/');

.. autofunction:: Caching#disable(path)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.disable('/bookmarks/');

.. autofunction:: Caching#set(path, strategy)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.set('/bookmarks/archive/', 'SEEN');

.. autofunction:: Caching#reset
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.reset();

