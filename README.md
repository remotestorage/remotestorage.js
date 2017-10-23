# remoteStorage.js

[![Build Status](http://img.shields.io/travis/remotestorage/remotestorage.js.svg?style=flat)](http://travis-ci.org/remotestorage/remotestorage.js)
[![Dependency Status](http://img.shields.io/david/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=dependencies)
[![devDependency Status](http://img.shields.io/david/dev/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/remotestorage/remotestorage.js.svg?style=flat)](https://codeclimate.com/github/remotestorage/remotestorage.js)
![IRC](https://img.shields.io/badge/irc%20channel-%23remotestorage%20on%20freenode-blue.svg)

remoteStorage.js is a JavaScript library for storing user data locally in the
browser, as well as connecting to [remoteStorage](http://remotestorage.io)
servers and syncing data across devices and applications.

### Where to get help?

* See [remotestorage.io](http://remotestorage.io/) for general information about remoteStorage
* Follow the [remoteStorage.js Beginners Guide](https://wiki.remotestorage.io/RemoteStorage.js:Beginners'_Guide) to get started
* Read detailed library documentation in the [remoteStorage.js API docs](https://remotestoragejs.readthedocs.io/en/latest/js-api.html)
* Ask questions on the [community forums](https://community.remotestorage.io/)
* Get instant support via IRC in [#remotestorage on Freenode](irc://irc.freenode.net:7000/remotestorage)

### Running a local test server

To develop remoteStorage-enabled apps, you need to have a
remoteStorage-compatible storage account. We recommend
[php-remote-storage](https://github.com/fkooman/php-remote-storage) (PHP) or
[mysteryshack](https://github.com/untitaker/mysteryshack) (Rust)
for running a local test server.

You can also get an account with a hoster, or use one of the various other
remoteStorage server implementations:
[Servers](https://wiki.remotestorage.io/Servers).

## Usage
[TODO]

### Node

    $ npm install remotestoragejs

See our [node.js documentation](https://remotestoragejs.readthedocs.io/en/latest/legacy/nodejs.html) for more details.

### Running tests

Install development dependencies including the
[testing framework](https://github.com/silverbucket/jaribu):

    $ npm install

Run all tests:

    $ npm test

Note: deliberate exceptions may look like errors, but if it says "all
tests passed" under the test output all is well for that test.

Use the `jaribu` executable in order to test single files, like so e.g.:

    $ node_modules/.bin/jaribu test/unit/baseclient-suite.js

### How to build

#### Docs

See our documentation page about [how to build the docs on your machine](https://remotestoragejs.readthedocs.io/en/latest/contributing/docs.html#how-to-build-the-docs-on-your-machine).

#### Build tasks

Display the available build tasks:

    $ make

Build everything:

    $ make all

### Credits

Original authors: Niklas Cathor, Michiel de Jong

See [list of all contributors](https://github.com/remotestorage/remotestorage.js/graphs/contributors)

Sponsored by [NLnet](https://nlnet.nl)

[![NLnet Logo](http://sockethub.org/res/img/nlnet-logo.svg)](https://nlnet.nl)
