Caching
=======

The caching class gets initialized as ``remoteStorage.caching``, unless the
:doc:`RemoteStorage </js-api/remotestorage>` instance is created with the
option ``cache: false``, disabling caching entirely.

In case your app hasn't explictly configured caching, the default setting is to
cache any documents that have been either created or requested since your app
loaded. For offline-capable apps, it usually makes sense to enable full,
automatic caching of all documents, which is what :func:`enable` will do.

Enabling full caching has several benefits:

* Speed of access: locally cached data is available to the app a lot faster.
* Offline mode: when all data is cached, it can also be read when your app
  starts while being offline.
* Initial synchronization time: the amount of data your app caches can
  have a significant impact on its startup time.

Caching can be configured on a per-path basis. When caching is enabled for a
folder, it causes all subdirectories to be cached as well.

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

.. autofunction:: Caching#checkPath(path)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.checkPath('documents/').then(strategy => {
       console.log(`caching strategy for 'documents/': ${strategy}`));
       // "caching strategy for 'documents/': SEEN"
     });

.. autofunction:: Caching#reset
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.reset();

