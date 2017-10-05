Caching
=======

Caching strategies
------------------

For each subtree, you can set the caching strategy to 'ALL', 'SEEN'
(default), and 'FLUSH'.

* 'ALL' means that once all outgoing changes have been pushed, sync will
  start retrieving nodes to cache pro-actively. If a local copy exists
  of everything, it will check on each sync whether the ETag of the root
  folder changed, and retrieve remote changes if they exist.
* 'SEEN' does this only for documents and folders that have been either
  read from or written to at least once since connecting to the current
  remote backend, plus their parent/ancestor folders up to the root (to
  make tree-based sync possible).
* 'FLUSH' will only cache outgoing changes, and forget them as soon as
  they have been saved to remote successfully.

List of functions
-------------------

.. autofunction:: Caching#set
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.caching.set('/bookmarks/archive')

.. autofunction:: Caching#enable
  :short-name:

.. autofunction:: Caching#disable
  :short-name:

.. autofunction:: Caching#onActivate
  :short-name:

.. autofunction:: Caching#checkPath
  :short-name:

.. autofunction:: Caching#reset
  :short-name:
