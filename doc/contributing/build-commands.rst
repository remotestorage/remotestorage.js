Build commands
==============

Here are the commands you will find useful as a contributor:

dev
---

Builds ``remotestorage.js`` in the ``release/`` directory every time you change
a file, using webpack in watch mode. This is useful when testing a change in
remoteStorage.js with an app, for example by creating a symlink to
``release/remotestorage.js``. This build is not minified and includes
comments::

   $ npm run dev

doc
---

See :doc:`the Documentation section of the Contributing docs</contributing/docs>`
