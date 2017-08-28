remoteStorage
=============

Initialization
--------------

.. code:: javascript

   const remoteStorage = new RemoteStorage();

Prototype methods
-----------------

.. autofunction:: RemoteStorage#setApiKeys
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.setApiKeys('dropbox', { appKey: 'your-app-key' });

     remoteStorage.setApiKeys('googledrive', { clientId: 'your-client-id' });}
