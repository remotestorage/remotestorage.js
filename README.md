# remoteStorage.js

[![Build Status](http://img.shields.io/travis/remotestorage/remotestorage.js.svg?style=flat)](http://travis-ci.org/remotestorage/remotestorage.js)
[![Dependency Status](http://img.shields.io/david/dev/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=dependencies)
[![devDependency Status](http://img.shields.io/david/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/remotestorage/remotestorage.js.svg?style=flat)](https://codeclimate.com/github/remotestorage/remotestorage.js)

remoteStorage.js is a JavaScript library for storing user data locally in the
browser, as well as connecting to [remoteStorage](http://remotestorage.io)
servers and syncing data across devices and applications.

### Where to get help?

* Use the [remoteStorage.js API docs](http://remotestorage.io/doc/code/)
* See [remotestorage.io](http://remotestorage.io/) for documentation, community
  forums, and links
* Get instant support via IRC in
  [#remotestorage on Freenode](irc://irc.freenode.net:7000/remotestorage)

### Running a local test server

To develop remoteStorage-enabled apps, you need to have a
remoteStorage-compatible storage account. We recommend
[reStore](https://github.com/jcoglan/restore) for running a local test server.
(Use the latest version from GitHub, not npm!)

You can also get an account with a hoster, or use one of the various other
remoteStorage server implementations:
[get storage](http://remotestorage.io/get/).

### Which version to choose?

You can either use a stable release or the current HEAD build. Stable releases
can be found in [release/](https://github.com/remotestorage/remotestorage.js/tree/master/release/).
Directories with a `-rcX` suffix contain release candidates, which may be used
for testing but aren't necessarily "stable" releases.

[release/head](https://github.com/remotestorage/remotestorage.js/tree/master/release/head/)
contains a semi-current HEAD build. It is updated manually and irregularly. To
build an up-to-date version of all files, run `make all` in the repository
root.

### Which build file to use for my app?

There are a number of different builds available:

* <kbd>remotestorage.js</kbd> - Contains all components of remotestorage.js for
  running in a browser.
* <kbd>remotestorage.amd.js</kbd> - The same as remotestorage.js, but wrapped
  for use with
  [AMD](https://en.wikipedia.org/wiki/Asynchronous_module_definition) loaders
  such as [RequireJS](http://requirejs.org/). When using AMD, be aware of issues
  [#709](https://github.com/remotestorage/remotestorage.js/issues/709).
* <kbd>remotestorage.min.js</kbd> - Minified version of remotestorage.js
* <kbd>remotestorage-nocache.js</kbd> - A version without any caching features
  included. Use this if you want your app to write directly to the remote
  server without caching any data in the browser's storage (localStorage or
  IndexedDB).
* <kbd>remotestorage-nocache.amd.js</kbd>,
  <kbd>remotestorage-nocache.min.js</kbd> - same as the other .amd/.min
  build, but based on remotestorage-nocache.js.


For more information on using the AMD build(s) and its dependencies, see the [AMD documentation](https://github.com/remotestorage/remotestorage.js/blob/master/doc/amd.md).

#### Bower

    $ bower install -S remotestorage

#### Node.js / NPM

    $ npm install remotestoragejs

See our [node.js documentation](https://github.com/remotestorage/remotestorage.js/blob/master/doc/nodejs.md) for more details.

### Running tests

Install development dependencies including the
[testing framework](https://github.com/silverbucket/jaribu):

    $ npm install

Run all suites:

    $ npm test

Use the `jaribu` executable in order to test single files, like so e.g.:

    $ node_modules/.bin/jaribu test/unit/baseclient-suite.js

### How to build

Make sure you have [Natural Docs](http://www.naturaldocs.org/) installed on
your system (e.g. via `sudo apt-get install naturaldocs`).

Display the available build tasks:

    $ make

Build everything:

    $ make all
