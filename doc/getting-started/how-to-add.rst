Adding rs.js to an app
======================

remoteStorage.js is distributed as a single :abbr:`UMD (Universal Module
Definition)` build, which means it should work with all known JavaScript module
systems, as well as without one (using a global variable).

We recommend adding the library from a JavaScript package manager, although you
may also just download the release build `from GitHub
<https://github.com/remotestorage/remotestorage.js/releases>`_.

The package is available on `npm <https://www.npmjs.com/>`_ as
``remotestoragejs`` and on `Bower <https://bower.io/>`_ as ``remotestorage``:

.. code:: bash

   $ npm install remotestoragejs

.. code:: bash

   $ bower install -S rs

Examples
--------

ES6 module
^^^^^^^^^^

.. code:: javascript

   import RemoteStorage from 'remotestoragejs';

CommonJS module
^^^^^^^^^^^^^^^

.. code:: javascript

   var RemoteStorage = require('remotestoragejs');

AMD module
^^^^^^^^^^

For example with `RequireJS <http://requirejs.org/>`_:

.. code:: javascript

   requirejs.config({
     paths: {
       RemoteStorage: './lib/remotestorage'
     }
   });

   requirejs(['RemoteStorage'], function(RemoteStorage) {
     // Here goes my app
   });

No module system
^^^^^^^^^^^^^^^^

If you just link the build from HTML, it will add ``RemoteStorage`` as a global
variable to ``window``.

.. code-block:: html

   <script type="text/javascript" src="remotestorage.js"></script>

Ember.js
^^^^^^^^

ES6 modules from npm should be supported natively soon, but for now you can use
`Browserify <http://browserify.org/>`_ via `ember-browserify
<https://www.npmjs.com/package/ember-browserify>`_, enabling you to import the
module from npm like this:

.. code:: javascript

   import RemoteStorage from 'npm:remotestoragejs';

Caveat emptor (no promises)
---------------------------

Please be aware of the fact that although remoteStorage.js is generally
compatible with older browsers as well as the latest ones, we do not include a
`polyfill <https://en.wikipedia.org/wiki/Polyfill>`_ for JavaScript Promises
anymore.

This means that, if you do not add your own polyfill, and no other library in
your build comes with one, rs.js will break in browsers, which do not support
Promises. A detailed overview of supported browsers is available `on
caniuse.com <https://caniuse.com/#search=promise>`_. Notable examples would be
Android up to 4.4 and Internet Explorer up to 11.

You can find a list of polyfill libraries `on the Promises website
<https://promisesaplus.com/implementations>`_. A good choice for a small and
simple polyfill would be `es6-promise-auto
<https://github.com/stefanpenner/es6-promise>`_ for example.
