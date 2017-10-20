RemoteStorage
=============

Constructor
-----------

Create a ``remoteStorage`` instance like so:

.. code:: javascript

   var remoteStorage = new RemoteStorage();

The constructor can optionally be called with a configuration object, for
example:

.. code:: javascript

   var remoteStorage = new RemoteStorage({
     logging: true,  // defaults to false
     cordovaRedirectUri: 'https://app.wow-much-app.com' // defaults to undefined
   });

.. NOTE::
   In the current version, it is only possible to use a single RemoteStorage
   instance. You cannot connect to two different remotes yet.  We intend to
   support this soon (see issue :issue:`991`)

Events
------

You can handle events from your ``remoteStorage`` instance by using the
``.on()`` function. For example:

.. code:: javascript

   remoteStorage.on('connected', function() {
     // Storage account has been connected, let’s roll!
   });

List of events
^^^^^^^^^^^^^^

``ready``
"""""""""
   Emitted when all features are loaded and the RS instance is ready

``not-connected``
"""""""""""""""""
   Emitted when ready, but no storage connected ("anonymous mode")

``connected``
"""""""""""""
   Emitted when a remote storage has been connected

``disconnected``
""""""""""""""""
   Emitted after disconnect

``error``
"""""""""
   Emitted when an error occurs

   Arguments: Error object

``features-loaded``
"""""""""""""""""""
   Emitted when all features are loaded

``connecting``
""""""""""""""
   Emitted before webfinger lookup

``authing``
"""""""""""
   Emitted before redirecting to the authing server

``wire-busy``
"""""""""""""
   Emitted when a wire request starts

``wire-done``
"""""""""""""
   Emitted when a wire request completes

``network-offline``
"""""""""""""""""""
   Emitted once when a wire request fails for the first time, and
   ``remote.online`` is set to false

``network-online``
""""""""""""""""""
   Emitted once when a wire request succeeds for the first time after a failed
   one, and ``remote.online`` is set back to true

Prototype functions
-------------------

The following functions can be called on your ``remoteStorage`` instance:

.. autofunction:: RemoteStorage#authorize(authURL, cordovaRedirectUri)
  :short-name:

.. autofunction:: RemoteStorage#connect(userAddress, token)
  :short-name:

.. autofunction:: RemoteStorage#disconnect
  :short-name:

.. autofunction:: RemoteStorage#enableLog
  :short-name:

.. autofunction:: RemoteStorage#disableLog
  :short-name:

.. autofunction:: RemoteStorage#getSyncInterval
  :short-name:

.. autofunction:: RemoteStorage#setSyncInterval(interval)
  :short-name:

.. autofunction:: RemoteStorage#getBackgroundSyncInterval
  :short-name:

.. autofunction:: RemoteStorage#setBackgroundSyncInterval(interval)
  :short-name:

.. autofunction:: RemoteStorage#getCurrentSyncInterval
  :short-name:

.. autofunction:: RemoteStorage#getRequestTimeout
  :short-name:

.. autofunction:: RemoteStorage#setRequestTimeout(timeout)
  :short-name:

.. autofunction:: RemoteStorage#scope(path)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.scope('/pictures/').getListing('');
     remoteStorage.scope('/public/pictures/').getListing('');

.. autofunction:: RemoteStorage#setApiKeys(apiKeys)
  :short-name:

  Example:

  .. code:: javascript

     remoteStorage.setApiKeys({
       dropbox: 'your-app-key',
       googledrive: 'your-client-id'
     });

.. autofunction:: RemoteStorage#setCordovaRedirectUri(uri)
  :short-name:

.. autofunction:: RemoteStorage#startSync
  :short-name:

.. autofunction:: RemoteStorage#stopSync
  :short-name:

.. autofunction:: RemoteStorage#onChange(path, handler)
  :short-name:
