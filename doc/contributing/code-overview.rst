Code overview
=============

The code of remoteStorage.js consists of files in the ``src/`` folder of this
repo. These are built into a single file in the ``release/`` folder using
`webpack <http://webpack.github.io/>`_. Unit tests live in the ``test/`` folder
and are based on `Jaribu <https://github.com/silverbucket/jaribu>`_.

The structure of the code is based around feature loading. Most files in
``src/`` correspond to a feature, e.g. ``discover.js`` to
``RemoteStorage.Discover`` or ``caching.js`` to ``RemoteStorage.Caching``.

The feature loading happens synchronously during the page load in
``src/remotestorage.js`` (just including this script in your app will lead to
executing the code that loads the features).

Most features load under their own name, but for ``remoteStorage.local`` a
choice is made between ``RemoteStorage.IndexedDB``,
``RemoteStorage.LocalStorage`` and ``RemoteStorage.InMemoryCaching``, depending
on what the environment (browser, node.js, Electron, WebView, or other)
supports.

For ``remoteStorage.local`` we then also have a `special mixin
<https://github.com/remotestorage/remotestorage.js/issues/777#issuecomment-57392440>`__
called ``src/cachinglayer.js``, which mixes in some common functions into the
object.

The ``remoteStorage.remote`` feature is not loaded immediately, but only when
``RemoteStorage.Discover`` calls ``remoteStorage.setBackend()``, at which point a
choice is made between ``RemoteStorage.WireClient``,
``RemoteStorage.GoogleDrive``, ``RemoteStorage.Dropbox`` (or any other future
backend) to become the ``remote``.
