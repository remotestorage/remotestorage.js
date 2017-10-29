Documentation
=============

The documentation for remoteStorage.js is generated from `reStructuredText
<http://docutils.sourceforge.net/rst.html>`_ files in the ``doc/`` folder, as
well as `JSDoc <http://usejsdoc.org/>`_ code comments, which are being pulled
in via special declarations in those files.

We use `Sphinx <http://www.sphinx-doc.org/>`_ to generate the documentation
website, and the `sphinx-js <https://pypi.python.org/pypi/sphinx-js/>`_
extension for handling the JSDoc part.

How to write reStructuredText and JSDoc
---------------------------------------

For learning both the basics and advances features of reStructuredText, we
highly recommend the `reStructuredText Primer
<http://www.sphinx-doc.org/en/stable/rest.html>`_ on the Sphinx website.

For JSDoc, you can find an intro as well as a detailed directive reference `on
their official website <http://usejsdoc.org/>`_.

Automatic builds and publishing
-------------------------------

The documentation is published via `Read the Docs <https://readthedocs.org/>`_.
Whenever the Git repository's ``master`` branch is pushed to GitHub, RTD will
automatically build a new version of the site and publish it to
`remotestoragejs.readthedocs.io <https://remotestoragejs.readthedocs.io>`_.

This means that if you want to contribute to the documentation [#f1]_, you don't
necessarily have to set up Sphinx and sphinx-js locally (especially for small
changes). However, if you want to preview what your local changes look like
when they are rendered as HTML, you will have to set up local builds first.

How to build the docs on your machine
-------------------------------------

Setup
^^^^^

1. `Install Python and PIP <https://pip.pypa.io/en/stable/installing/>`_
   (likely already installed)

2. Install sphinx::

   $ pip install sphinx

3. Install required extensions (from repository root)::

   $ pip install -r doc/requirements.txt

4. Install JSDoc globally via npm::

   $ npm install -g jsdoc

Build
^^^^^

Run the following command to automatically watch and build the documentation::

   $ npm run doc

This will start a web server, serving the HTML docs on `<http://localhost:8000>`_.

.. HINT::
   The autobuild cannot watch for changes in JSDoc comments as of now, so you
   will need to re-run the command, or change something in a ``.rst`` file in
   order for code documentation changes to be re-built.

.. rubric:: Footnotes

.. [#f1] Every single bit helps other people! Even fixing a typo is worth a
         pull request.
