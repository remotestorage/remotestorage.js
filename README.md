# remoteStorage.js

[![Build Status](https://secure.travis-ci.org/remotestorage/remotestorage.js.png)](http://travis-ci.org/remotestorage/remotestorage.js)

### Where to get help?

* See [remotestorage.io](http://remotestorage.io/) for documentation, community forums, and links.

### Running a local test server

To test remoteStorage-enabled apps, you need to have a remoteStorage-compatible storage account.

To find out how to get one, see [Get Storage on remotestorage.io](http://remotestorage.io/get/).

### Which version to choose?

You can either use a stable release or the current HEAD build. Stable releases
can be found in [release/](https://github.com/remotestorage/remotestorage.js/tree/master/release/).
Those directories having a "-rcX" suffix contain release candidates, which may
be used for testing but aren't necessarily "stable" releases.

The toplevel directory contains a semi-current HEAD build. It is updated
manually and irregularly. To build an up-to-date version of all files, run
`make all` in the repository root.

### Which build file to use for my app?

There are a number of different builds available:

* <kbd>remotestorage.js</kbd> - Contains all components of remotestorage.js for running in a browser.
* <kbd>remotestorage.amd.js</kbd> - The same as remotestorage.js, but wrapped for use with [AMD](https://en.wikipedia.org/wiki/Asynchronous_module_definition) loaders such as [RequireJS](http://requirejs.org/).
* <kbd>remotestorage.min.js</kbd> - Minified version of remotestorage.js
* <kbd>remotestorage-nocache.js</kbd> - Contains a version of remotestorage.js without any caching features included. Use this if you want your app to write directly to the remote server **without caching** any data in the browser's storage (localStorage or indexedDB).
* <kbd>remotestorage-nocache.amd.js</kbd>, <kbd>remotestorage-nocache.min.js</kbd> - same as the other .amd / .min build, but based on remotestorage-nocache.js.

### How to build

Run `make` to display the available build tasks.

With node-uglify and naturaldocs installed, you can run `make all` to build everything.
