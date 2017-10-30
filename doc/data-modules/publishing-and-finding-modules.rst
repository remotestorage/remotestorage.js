Publishing and finding data modules
===================================

npm
---

The recommended way for publishing data modules is as `npm
<https://www.npmjs.com/>`_ packages.

Our naming convention for rs.js modules is
``remotestorage-module-mymodulename``. Thus, you can also find them by
`searching npm for "remotestorage-module"
<https://www.npmjs.com/search?q=remotestorage-module>`_.

You can also add "remotestorage-module" and "remotestorage" to the ``keywords``
property of your ``package.json``.

GitHub & Co.
------------

If you use GitHub ‒ or any other code hosting/collaboration platform for that
matter ‒ for publishing your module's source code, please use the same naming
convention as for the npm module for the repo name. And it's a good idea to add
the topic/tag/label "remotestorage-module" there as well, of course.

https://github.com/topics/remotestorage-module

.. HINT::
   With npm, you can also install modules directly from a Git repo or GitHub,
   pointing to just the repo or a branch name, tag, or commit:
   https://docs.npmjs.com/files/package.json#github-urls

Examples
--------

* For a real-world example of a data module package, see e.g. the shares module
  `on GitHub <https://github.com/skddc/remotestorage-module-shares>`_ and `on
  npm <https://www.npmjs.com/package/remotestorage-module-shares>`_. Check out
  ``webpack.config.js`` and the source code in ``index.js`` to see how it is
  built and exported.

.. NOTE::
   Unfortunately, we didn't have any package management for data modules before
   rs.js 1.0. To be fair, JavaScript package managers weren't actually a thing
   yet, when this functionality was added to the library. However, it means
   we're still in the process of porting and publishing modules and you won't
   find very many existing data modules on npm right now. You can check the
   `old modules repo <https://github.com/remotestorage/modules>`_ for source
   code of legacy modules.
