Access
======

This class is for requesting and managing access to modules/folders on
the remote.

List of functions
-----------------

.. autofunction:: Access#claim
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.access.claim('contacts', 'r');
     remoteStorage.access.claim('pictures', 'rw');

  Claiming root access, meaning complete access to all files and folders
  of a storage, can be done using an asterisk for the scope:

  .. code:: javascript

     remoteStorage.access.claim('*', 'rw');

.. autofunction:: Access#get
  :short-name:

.. autofunction:: Access#remove
  :short-name:

.. autofunction:: Access#checkPermission
  :short-name:

.. autofunction:: Access#checkPathPermission
  :short-name:

.. autofunction:: Access#reset
  :short-name:
