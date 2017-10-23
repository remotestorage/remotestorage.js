Caching
=======

remoteStorage.js gives you the option to synchronize some or all of the
remote data your app has access to, to a local store. Usually this store
is an IndexedDB database.

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

For a list of the available caching strategies, see :ref:`caching-strategies`.

There are two ways to configure caching:

* globally through ``remoteStorage.caching`` - this would usually be done by an app.
* locally through ``BaseClient#cache`` - this would usually be done by a module.

Configuring caching from a module
---------------------------------

The ``BaseClient#cache`` interface is only a convenience method that
internally uses ``remoteStorage.caching``.

This example shows how to configure caching in a module:

.. code:: javascript

   var beersBuilder = function (privateClient, publicClient) {
     var pilsener = privateClient.scope('pilsener/');

     // To enable always caching all data (not only data that was changed),
     // change the caching strategy from 'SEEN' (the default) to 'ALL'.
     // These two are equivalent operations:
     privateClient.cache('pilsener/', 'ALL');
     // OR:
     pilsener.cache('', 'ALL');

     // To disable caching for a given path, pass 'FLUSH' as the strategy:
     privateClient.cache('pilsener/', 'FLUSH');
     // OR:
     pilsener.cache('', 'FLUSH');

     return {
       exports: {
         pilsener: pilsener
       }
     };
   });

   export default { name: 'beers', builder: beersBuilder };

Configuring caching from the app
--------------------------------

If you want to alter caching settings outside of a module's context, you
can do so using the ``remoteStorage.caching`` interface.

This example shows how to do that:

.. code:: javascript

   remoteStorage.caching.enable('/beers/pilsener/');

   remoteStorage.caching.disable('/beers/pilsener/');

or to use a different caching strategy:

.. code:: javascript

   remoteStorage.caching.set('/beers/ale/', 'SEEN');


Synchronizing after caching settings have changed
-------------------------------------------------

Whenever you have changed the caching settings, you can either wait for
the next automatic synchronization to happen, or trigger one yourself:

.. code:: javascript

   remoteStorage.sync.sync().then(function() {
     console.log("Synchronization finished.");
   });

Internals
---------

This section is aimed at developers of remoteStorage.js. The caching
strategies are stored in ``remoteStorage.caching._rootPaths``. For
instance, on https://myfavoritedrinks.5apps.com/, it has the value
``{ /myfavoritedrinks/: "ALL" }``.

The rootPaths are not stored in localStorage. If you refresh the page,
it is up to the app to set all caching strategies again during the
page load.

The effect of the caching strategy is basically achieved through three
paths:

1. Setting caching strategy 'ALL' for a path, creates an empty node for
   that path, unless it already exists.
2. The sync process will then do a 'GET', and create new nodes under any
   folder with an 'ALL' strategy, when that folder is fetched.
3. The sync process will create a new task for any node under an 'ALL'
   strategy, unless a task already exists for one of its ancestors.

The result is all paths with an explicit 'ALL' strategy will get
fetched, and if they are folders, then in the next round, all its
children will also be fetched, etcetera.
