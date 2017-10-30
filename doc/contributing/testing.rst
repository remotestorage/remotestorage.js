Testing
=======

Before contributing to remoteStorage.js, make sure your patch passes the test
suite, and your code style passes the code linting suite.

We use the `Jaribu <https://github.com/silverbucket/jaribu>`_ framework for our
test suites and `JSHint <http://jshint.com/about/>`_ for linting. Both are set
as dev dependencies in ``package.json``, so after installing those via ``npm
install``, you can use the following command to run everything at once:

.. CODE:: bash

   $ npm run test

Or you can use the Jaribu executable directly in order to run the suite for a
single file:

.. CODE:: bash

   $ ./node_modules/.bin/jaribu test/unit/cachinglayer-suite.js

.. TIP::
   If you add ``./node_modules/.bin`` to your ``PATH``, you can call
   executables in any npm project directly. For example in ``~/.bashrc``, add
   the line ``export PATH=$PATH:./node_modules/.bin`` (and run ``source
   ~/.bashrc`` to load that change in open terminal sessions).  Then you can
   just run ``jaribu test/unit/foo_suite.js``.

Continous integration
---------------------

The rs.js test suite is run by Travis CI on every push to our repo on GitHub.
When you open a pull request, your code will be tested there, too. You can
check out the build status and history at
https://travis-ci.org/remotestorage/remotestorage.js/, and the CI settings in
``.travis.yml``.
