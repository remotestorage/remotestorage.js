Usage with node.js
==================

.. ATTENTION::
   This document has not yet been updated for rs.js 1.0.0+

Although remoteStorage.js was initially written for being used within a
browser, we do support using it within a node.js environment as well. However,
some things, which work in browsers, might not work without additional
libraries and customizations.

Installation
------------

Base library
^^^^^^^^^^^^

remoteStorage.js is available from npm::

   $ npm install remotestoragejs

Modules
^^^^^^^

Currently the remotestorage.js modules are not packaged as part of the
``remotestoragejs`` npm module. So you will need to download (or create) your
own module to use. You can visit our `modules repository`_ to see existing
modules, feel free to submit a pull request if you've written your own.

For this example, let's use the `feeds module`_.

Download a copy of this module and place it in your project somewhere, let's
say ``src/remotestorage-feeds.js`` for the purpose of this document.

Initialization
--------------

The initialization process for creating an instance of RemoteStorage is as
follows.

create
^^^^^^

.. code:: javascript

    var RemoteStorage = require('remotestoragejs');
    var remoteStorage = new RemoteStorage({
        logging: true  // optinally enable debug logs (defaults to false)
    });

global
^^^^^^

At this time, there are still some browser-specific requirements within the
library that require us (for the time-being) to place our newly created
remoteStorage object into nodes global scope. This is so our modules can access
the object as they currently expect to do (we hope to address this issue soon).

.. code:: javascript

    global.remoteStorage = remoteStorage;

on ready
^^^^^^^^

Now we can hook up to the ``'ready'`` event which will be called once our
library has initialized.

.. code:: javascript

    remoteStorage.on('ready', beginApp);

We will make the function ``beginApp()`` shortly.

Configuring a remote
--------------------

In order to use a remote, you will need a Webfinger [#f1]_ user address and an
OAuth [#f2]_ bearer token for the desired category. You will need to provide
these two values on your own outside of the program script, for example in an
already authorized web-app which uses the module you'd like to use here. Within
the web-app you should be able to inspect the ``remoteStorage.remote.token``.

.. code:: javascript

    var userAddress = ''; // fill me in
    var token = ''; // fill me in

    RemoteStorage.Discover(userAddress).then(function (obj) {
        console.log('- configuring remote', userAddress, obj.href, obj.storageType);
        remoteStorage.remote.configure({
            userAddress: userAddress,
            href: obj.href,
            storageApi: obj.storageType,
            properties: obj.properties,
            token: token
        });
    });

on connected
^^^^^^^^^^^^

Although you can start using remoteStorage as soon as the ready event files,
these events tell us whether/when we've connected to the remote storage target.
When we've connected, all changes we make will be automatically synced with our
remote.

.. code:: javascript

    remoteStorage.on('connected', function() {
        console.log('- connected to remote (syncing will take place)');
    });

    remoteStorage.on('not-connected', function() {
        console.log('- not connected to remote (changes are local-only)');
    });

Module
------

include
^^^^^^^

Now let's include our ``feeds`` module. If the file was placed in our project as
``src/remotestorage-feeds.js``, then this is how we'd include it.

.. code:: javascript

    require('./src/remotestorage-feeds.js');

Currently the modules attach themselves to the global ``remotesStorage`` object
directly, which is why we needed to make it global earlier.

claim access
^^^^^^^^^^^^

We'll need to claim access to our module in order to use it:

.. code:: javascript

    remoteStorage.access.claim('feeds', 'rw');

on change
^^^^^^^^^

To become alerted to our modules change event's (which occurs when our module
data has been updated either locally or remotely), we do the following.

.. code:: javascript

    remoteStorage.feeds.rssAtom.on('change', function (event) {
        console.log('- received change event: ', event);
    });

Using our module
----------------

Now that all of the initialization is in place, let's create the function which
will be called when ``remoteStorage`` fires the ``'ready'`` event.

.. code:: javascript

    function beginApp {
        // create a feed record
        remoteStorage.feeds.rssAtom.create({
            url: 'testurl',
            title: 'this is a test'
        })
        .then(function (feed) {
            console.log('- feed created ', feed);

            // retrieve all feeds
            remoteStorage.feeds.rssAtom.getAll()
            .then(function (feeds) {
                console.log('- all feeds', feeds);
            }, function (error) {
                console.log('*** error fetching all feeds', error);
            });
        });
    }


Complete script
---------------

Here's our final script.

.. code:: javascript

  // initialize remoteStorage
  var RemoteStorage = require('remotestoragejs');
  var remoteStorage = new RemoteStorage({
      logging: true  // optinally enable debug logs (defaults to false)
  });
  global.remoteStorage = remoteStorage;

  remoteStorage.on('ready', beginApp);

  // configure remote
  var userAddress = ''; // fill me in
  var token = ''; // fill me in

  RemoteStorage.Discover(userAddress).then(function (obj) {
      console.log('- configuring remote', userAddress, obj.href, obj.storageType);
      remoteStorage.remote.configure({
          userAddress: userAddress,
          href: obj.href,
          storageAPI: obj.storageType,
          properties: properties,
          token: token
      });
  });

  remoteStorage.on('connected', function() {
    console.log('- connected to remote (syncing will take place)');
  });

  remoteStorage.on('not-connected', function() {
    console.log('- not connected to remote (changes are local-only)');
  });

  // initialize module
  require('./src/remotestorage-feeds.js');
  remoteStorage.access.claim('feeds', 'rw');

  remoteStorage.feeds.rssAtom.on('change', function (event) {
      console.log('- received change event: ', event);
  });

  function beginApp() {
      // create a feed record
      remoteStorage.feeds.rssAtom.create({
          url: 'testurl',
          title: 'this is a test'
      })
      .then(function (feed) {
          console.log('- feed created ', feed);
          // retrieve all feeds
          remoteStorage.feeds.rssAtom.getAll()
          .then(function (feeds) {
              console.log('- all feeds', feeds);
          }, function (error) {
              console.log('*** error fetching all feeds', error);
          });
      });
  }


.. rubric:: Footnotes

.. [#f1] See :RFC:`7033`
.. [#f2] See :RFC:`6749`

.. _modules repository: https://github.com/RemoteStorage/modules
.. _feeds module: https://github.com/remotestorage/modules/blob/master/src/feeds.js
