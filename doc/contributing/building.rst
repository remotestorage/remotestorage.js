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
``release/remotestorage.js``.

This build includes [source
maps](https://www.html5rocks.com/en/tutorials/developertools/sourcemaps/)
directly, so you can easily place ``debugger`` statements in the code and step
through the actual source code in your browser's debugger tool.

Production
----------

.. CODE:: bash

   $ npm run build

This creates the minified production build in ``release/``.

It also creates a seperate source maps file, which you can link to in case you
want to (e.g. to improve exception tracking/debugging in production).
