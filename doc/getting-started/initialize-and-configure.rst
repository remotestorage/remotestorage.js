Initialization & configuration
==============================

Now that you've imported the ``RemoteStorage`` class, here's how you typically
set things up.

.. NOTE::
   Where and how you do this exactly will naturally depend on the rest of your
   code, your JS framework, and personal preferences.

.. role:: raw-html(raw)
   :format: html

Initializing an instance
------------------------

First step is to initialize a ``remoteStorage`` instance::

   const remoteStorage = new RemoteStorage();

The constructor optionally takes a configuration object. Let's say we want to
enable debug logging to see in the console what rs.js is doing behind the
scenes::

   const remoteStorage = new RemoteStorage({logging: true});

Or perhaps we're building an app that doesn't need local caching, but only
operates on the remote server/account::

   const remoteStorage = new RemoteStorage({cache: false});

:raw-html:`<small>`
Also see the :doc:`RemoteStorage API doc </js-api/remotestorage>`.
:raw-html:`</small>`

Claiming access
---------------

Next, we need to tell *rs.js* which parts of the user's storage we want to
access. Let's say we want to read and write a user's favorite drinks, which
they might have added via the `My Favorite Drinks
<https://github.com/RemoteStorage/myfavoritedrinks>`_ demo app::

   remoteStorage.access.claim('myfavoritedrinks', 'rw');

Now, when they connect their storage, users will be asked to give the app
read/write access to the ``myfavoritedrinks/`` folder. And that's also what the
OAuth token, which we receive from their storage server, will be valid for, of
course.

If you want to build a special app, like for example a backup utility, or a
data browser, you can also claim access to the entire storage (which is
generally discouraged)::

   remoteStorage.access.claim('*', 'rw');

:raw-html:`<small>`
Also see the :doc:`Access API doc </js-api/access>`.
:raw-html:`</small>`

Configuring caching
-------------------

Last but not least, we'll usually want to configure caching (and with it
automatic sync) for the data we're accessing. The ``caching.enable()`` method
will activate full caching for the given path, meaning all of the items therein
will be automatically synced from and to the server::

   remoteStorage.caching.enable('/myfavoritedrinks/')

:raw-html:`<small>`
See the :doc:`Caching API doc </js-api/caching>` for details and options.
:raw-html:`</small>`
