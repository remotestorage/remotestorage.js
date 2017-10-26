Usage with Node.js
==================

Although remoteStorage.js was initially written for being used in a
browser, we do support using it in a Node.js environment as well.

Installation
------------

Client library
^^^^^^^^^^^^^^

remoteStorage.js is available from npm::

   $ npm install remotestoragejs

Modules
^^^^^^^

remoteStorage.js modules are not packaged as part of the ``remotestoragejs``
npm module. You will need to download (or create) your own module to use. You
can visit our `modules repository`_ to see existing modules, feel free to
submit a pull request if you've written your own.

They can also be published as npm modules: `search for "remotestorage-module" on npm`_ to find them.

As of remoteStorage.js 1.0 you do not need to declare a ``remoteStorage`` global
for modules to work in Node.js any longer, because they can be ES6 modules.

Caveats
-------

* The OAuth browser redirect is not supported, you need to pass a token to the
  `remotestorage.connect()` as the second argument. See the documentation on
  the :doc:`RemoteStorage API doc</js-api/remotestorage>`. For example you
  can use a web app to connect to the storage server and get the OAuth bearer
  token using ``remoteStorage.remote.token`` in the console.
* IndexedDB and LocalStorage are not supported in a Node.js environment, for
  local storage only in-memory storage is supported.


Examples
--------

* `hubot-remotestorage-logger`_, a Hubot script that logs chat messages to
  remoteStorage-enabled accounts using the `remotestorage-module-chat-messages`_
  module
* `rs-backup`_, a program that allows you to backup your data from a
  remoteStorage account to a local hard drive and restore it to the same or
  another account or server. It does not use remoteStorage modules or the
  remoteStorage.js client library.

.. _modules repository: https://github.com/RemoteStorage/modules
.. _search for "remotestorage-module" on npm: https://www.npmjs.com/search?q=remotestorage-module
.. _hubot-remotestorage-logger: https://github.com/67P/hubot-remotestorage-logger
.. _remotestorage-module-chat-messages: https://www.npmjs.com/package/remotestorage-module-chat-messages
.. _rs-backup: https://github.com/skddc/rs-backup
