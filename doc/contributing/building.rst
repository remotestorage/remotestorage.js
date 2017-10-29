Building
========

.. HINT::
   We're using npm scripts for all common tasks, so check out the ``scripts``
   section in ``package.json`` to learn about what they're doing exactly and
   what else is available.

Development
-----------

.. CODE:: bash

   $ npm run dev

This will watch ``src/`` for changes and build ``remotestorage.js`` in the
``release/`` directory every time you save a source file. Useful for testing
rs.js changes with an app, for example by creating a symlink to
``release/remotestorage.js``. This build is not minified and includes comments.

Production
----------

.. CODE:: bash

   $ npm run build

This creates the normal production build in ``release/``, minified and without
comments (except for the version banner in the first line of the file).
