Access
======

This class is for requesting and managing access to modules/folders on
the remote. It gets initialized as ``remoteStorage.access``.

List of functions
-----------------

.. autofunction:: Access#claim(scope, mode)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.access.claim('contacts', 'r');
     remoteStorage.access.claim('pictures', 'rw');

  Claiming root access, meaning complete access to all files and folders
  of a storage, can be done using an asterisk for the scope:

  .. code:: javascript

     remoteStorage.access.claim('*', 'rw');

