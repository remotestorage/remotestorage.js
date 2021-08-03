.. highlight:: console

Documentation
=============

The documentation for remoteStorage.js is generated from `reStructuredText
<http://docutils.sourceforge.net/rst.html>`_ files in the ``doc/`` folder, as
well as `TypeDoc <https://typedoc.org/>`_ code comments, which are being pulled
in via special declarations in those files.

We use `Sphinx <http://www.sphinx-doc.org/>`_ to generate the documentation
website, and the `sphinx-js <https://pypi.python.org/pypi/sphinx-js/>`_
extension for handling the TypeDoc part.

How to write reStructuredText and TypeDoc
-----------------------------------------

For learning both the basics and advances features of reStructuredText, we
highly recommend the `reStructuredText Primer
<http://www.sphinx-doc.org/en/stable/rest.html>`_ on the Sphinx website.

For TypeDoc, you can find guides as well as a detailed reference `on
the project's website <https://typedoc.org/>`_.

Automatic builds and publishing
-------------------------------

The documentation is published via `Read the Docs <https://readthedocs.org/>`_.
Whenever the Git repository's ``master`` branch is pushed to GitHub, RTD will
automatically build a new version of the site and publish it to
`remotestoragejs.readthedocs.io <https://remotestoragejs.readthedocs.io>`_.

This means that if you want to contribute to the documentation, you don't
necessarily have to set up Sphinx and sphinx-js locally (especially for small
changes). However, if you want to preview what your local changes look like
when they are rendered as HTML, you will have to set up local builds first.

How to build the docs on your machine
-------------------------------------

Setup
^^^^^

1. `Install Python and PIP <https://pip.pypa.io/en/stable/installing/>`_
   (likely already installed)

2. Install sphinx-js and extensions (from repository root)::

   $ pip install -r doc/requirements.txt

3. Install TypeScript and TypeDoc globally (so Sphinx can use them)::

   $ npm -g install typescript typedoc

Build
^^^^^

Run the following command to automatically watch and build the documentation::

   $ npm run autobuild-docs

This will start a web server, serving rendered HTML docs on `<http://localhost:8000>`_.

.. HINT::
   The autobuild cannot watch for changes in TypeDoc comments as of now, so you
   will need to re-run the command, or change something in a ``.rst`` file in
   order for code documentation changes to be re-built.

How to build the docs using ReadTheDocs' Docker image
-----------------------------------------------------

This is useful for troubleshooting when the ReadTheDocs build is failing.

Setup
^^^^^

1. `Install Docker <https://docs.docker.com/get-docker/>`_

2. Pull the latest version of ``readthedocs/build`` image with the ``latest`` tag from Docker Hub::

    $ docker pull readthedocs/build:latest

Build
^^^^^

1. Enter a ``bash`` session while attaching this project as a volume::

    $ docker run --rm -it -v ${PWD}:/app readthedocs/build:latest bash

2. Run the ``build-with-conda.sh`` script to setup conda environment and build the docs like ReadTheDocs::

    $ /app/doc/build-with-conda.sh
