Caching
=======

The caching strategies are stored in
``remoteStorage.caching._rootPaths``. For instance, on
https://myfavoritedrinks.remotestorage.io/, it has the value ``{
/myfavoritedrinks/: "ALL" }``.

These rootPaths are not stored in localStorage. If you refresh the page,
it is up to the app to set all caching strategies again during the
page load.

The effect of the caching strategy is basically achieved through three
paths:

1. Setting caching strategy 'ALL' for a path creates an empty node for
   that path, unless it already exists.
2. The sync process will then do a GET request, and create new nodes
   under any folder with an 'ALL' strategy, when that folder is fetched.
3. The sync process will create a new task for any node under an 'ALL'
   strategy, unless a task already exists for one of its ancestors.

The result is all paths with an explicit 'ALL' strategy will get
fetched, and if they are folders, then in the next round, all its
children will also be fetched, etcetera.
