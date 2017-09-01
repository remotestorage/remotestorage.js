remoteStorage
=============

Initialization
--------------

.. code:: javascript

   const remoteStorage = new RemoteStorage();

Prototype methods
-----------------

.. autofunction:: RemoteStorage#scope
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.scope('/pictures/').getListing('');
     remoteStorage.scope('/public/pictures/').getListing('');

.. autofunction:: RemoteStorage#setApiKeys
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.setApiKeys('dropbox', { appKey: 'your-app-key' });
     remoteStorage.setApiKeys('googledrive', { clientId: 'your-client-id' });}
