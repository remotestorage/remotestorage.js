Usage with Node.js
==================

Although remoteStorage.js was initially written for being used in a
browser, we do support using it in a Node.js environment as well.

Differences between normal usage and Node.js
--------------------------------------------

The OAuth browser redirect is not supported, you need to pass a token to the
`remotestorage.connect()` as the second argument. See the documentation on
the :doc:`RemoteStorage API doc</js-api/remotestorage>`.

You can use a web app to connect to the storage server and get the OAuth bearer
token using ``remoteStorage.remote.token`` in the console.

If you are writing a Node.js command line application you can open a browser
window to let the user create an OAuth token (or return an existing one) and
redirect it to a web page that displays it so they can they paste it in their
terminal. Here is how `rs-backup`_, a remoteStorage backup utility, does it:
`authorization dialog from Node.js`_ and the matching HTML `auth page`_.

Installation
------------

Client library
^^^^^^^^^^^^^^

See :doc:`Adding rs.js to your app</getting-started/how-to-add>`.

Modules
^^^^^^^

TODO: See the upcoming Data Modules docs

Caveats
-------

* IndexedDB and LocalStorage are not supported in a Node.js environment, for
  local storage only in-memory storage is supported. It means that
  unsynchronized data will be lost between sessions and program executions.

Examples
--------

* `hubot-remotestorage-logger`_, a Hubot script that logs chat messages to
  remoteStorage-enabled accounts using the `chat-messages`_ module

.. _authorization dialog from Node.js: https://github.com/skddc/rs-backup/blob/v1.5.0/backup.js#L137-L160
.. _auth page: https://github.com/skddc/rs-backup-auth-page/blob/a91b487413f3a3531883a6cee9751c5b536edaa4/index.html#L72-L96
.. _hubot-remotestorage-logger: https://github.com/67P/hubot-remotestorage-logger
.. _chat-messages: https://www.npmjs.com/package/remotestorage-module-chat-messages
.. _rs-backup: https://github.com/skddc/rs-backup
