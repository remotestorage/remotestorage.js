RemoteStorage
=============

Constructor
-----------

Create a ``remoteStorage`` instance like so::

   var remoteStorage = new RemoteStorage();

The constructor can optionally be called with a configuration object. This
example shows all default values::

   var remoteStorage = new RemoteStorage({
     cache: true,
     changeEvents: {
       local:    true,
       window:   false,
       remote:   true,
       conflict: true
     },
     cordovaRedirectUri: undefined,
     logging: false,
     modules: []
   });

.. NOTE::
   In the current version, it is only possible to use a single
   ``RemoteStorage`` instance. You cannot connect to two different remotes yet.
   We intend to support this soon (see issue :issue:`991`)

.. WARNING::
   For the change events configuration, you currently have to set all events
   explicitly.  Otherwise it would disable the unspecified ones. (see issue
   :issue:`1025`)

Events
------

You can handle events from your ``remoteStorage`` instance by using the
``.on()`` function. For example::

   remoteStorage.on('connected', function() {
     // Storage account has been connected, let’s roll!
   });

.. _rs-events:

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
   Emitted when an error occurs; receives an error object as argument

   There are a handful of known errors, which are identified by the ``name``
   property of the error object:

   .. table::

      ================== ============================================================
      Name               Description
      ================== ============================================================
      ``Unauthorized``   Emitted when a network request resulted in a 401 or 403
                         response. You can use this event to handle invalid OAuth
                         tokens in custom UI (i.e. when a stored token has been
                         revoked or expired by the RS server).
      ``DiscoveryError`` A variety of storage discovery errors, e.g. from user
                         address input validation, or user address lookup issues
      ================== ============================================================

   Example::

      remoteStorage.on('error', err => console.log(err));

      // {
      //   name: "Unauthorized",
      //   message: "App authorization expired or revoked.",
      //   stack: "Error↵  at new a.Unauthorized (vendor.js:65710:41870)"
      // }

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
   Emitted when a network request starts

``wire-done``
"""""""""""""
   Emitted when a network request completes

``sync-req-done``
"""""""""""""""""
   Emitted when a single sync request has finished

``sync-done``
"""""""""""""
   Emitted when all tasks of a sync have been completed and a new sync
   is scheduled

``network-offline``
"""""""""""""""""""
   Emitted once when a wire request fails for the first time, and
   ``remote.online`` is set to false

``network-online``
""""""""""""""""""
   Emitted once when a wire request succeeds for the first time after a failed
   one, and ``remote.online`` is set back to true

``sync-interval-change``
""""""""""""""""""""""""
   Emitted when the sync interval changes

Prototype functions
-------------------

The following functions can be called on your ``remoteStorage`` instance:

.. autofunction:: RemoteStorage#authorize(authURL, [cordovaRedirectUri])
  :short-name:

.. autofunction:: RemoteStorage#connect(userAddress, [token])
  :short-name:

  Example::

     remoteStorage.connect('user@example.com');

.. autofunction:: RemoteStorage#disconnect
  :short-name:

  Example::

     remoteStorage.disconnect();

.. autofunction:: RemoteStorage#enableLog
  :short-name:

  Example::

     remoteStorage.enableLog();

.. autofunction:: RemoteStorage#disableLog
  :short-name:

  Example::

     remoteStorage.disableLog();

.. autofunction:: RemoteStorage#getSyncInterval
  :short-name:

  Example::

     remoteStorage.getSyncInterval();
     // 10000

.. autofunction:: RemoteStorage#setSyncInterval(interval)
  :short-name:

  Example::

     remoteStorage.setSyncInterval(10000);

.. autofunction:: RemoteStorage#getBackgroundSyncInterval
  :short-name:

  Example::

     remoteStorage.getBackgroundSyncInterval();
     // 60000

.. autofunction:: RemoteStorage#setBackgroundSyncInterval(interval)
  :short-name:

  Example::

     remoteStorage.setBackgroundSyncInterval(60000);

.. autofunction:: RemoteStorage#getCurrentSyncInterval
  :short-name:

  Example::

     remoteStorage.getCurrentSyncInterval();
     // 15000

.. autofunction:: RemoteStorage#getRequestTimeout
  :short-name:

  Example::

     remoteStorage.getRequestTimeout();
     // 30000

.. autofunction:: RemoteStorage#setRequestTimeout(timeout)
  :short-name:

  Example::

     remoteStorage.setRequestTimeout(30000);

.. autofunction:: RemoteStorage#scope(path)
  :short-name:

  Example::

     remoteStorage.scope('/pictures/').getListing('');
     remoteStorage.scope('/public/pictures/').getListing('');

.. autofunction:: RemoteStorage#setApiKeys(apiKeys)
  :short-name:

  Example::

     remoteStorage.setApiKeys({
       dropbox: 'your-app-key',
       googledrive: 'your-client-id'
     });

.. autofunction:: RemoteStorage#setCordovaRedirectUri(uri)
  :short-name:

  Example::

     remoteStorage.setCordovaRedirectUri('https://app.wow-much-app.com');

.. autofunction:: RemoteStorage#startSync
  :short-name:

  Example::

     remoteStorage.startSync();

.. autofunction:: RemoteStorage#stopSync
  :short-name:

  Example::

     remoteStorage.stopSync();

.. autofunction:: RemoteStorage#on(eventName, handler)
  :short-name:

  Example::

     remoteStorage.on('connected', function() {
       console.log('user connected their storage');
     });

.. autofunction:: RemoteStorage#onChange(path, handler)
  :short-name:

  Example::

     remoteStorage.onChange('/bookmarks/', function() {
       // your code here
     })
