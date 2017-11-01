# remoteStorage.js

[![npm](https://img.shields.io/npm/v/remotestoragejs.svg)](https://www.npmjs.com/package/remotestoragejs)
[![Build Status](http://img.shields.io/travis/remotestorage/remotestorage.js.svg?style=flat)](http://travis-ci.org/remotestorage/remotestorage.js)
[![Dependency Status](http://img.shields.io/david/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=dependencies)
[![devDependency Status](http://img.shields.io/david/dev/remotestorage/remotestorage.js.svg?style=flat)](https://david-dm.org/remotestorage/remotestorage.js#info=devDependencies)
[![Code Climate](http://img.shields.io/codeclimate/github/remotestorage/remotestorage.js.svg?style=flat)](https://codeclimate.com/github/remotestorage/remotestorage.js)

remoteStorage.js is a JavaScript library for storing user data locally in the
browser, as well as connecting to [remoteStorage](http://remotestorage.io)
servers and syncing data across devices and applications. It is also capable of
connecting and syncing data with a person's Dropbox or Google Drive account
(optional).

The library is well-tested and actively maintained. It is safe to use in
production.

### Where to get help?

* See [remotestorage.io](http://remotestorage.io/) for general information
  about the remoteStorage protocol
* Read [the docs](http://remotestoragejs.readthedocs.io/) (source files in `doc/`)
    * [Why use this?](https://remotestoragejs.readthedocs.io/en/latest/why.html)
    * [Getting started](https://remotestoragejs.readthedocs.io/en/latest/getting-started.html)
    * [Data modules](https://remotestoragejs.readthedocs.io/en/latest/data-modules.html)
    * [JavaScript API](https://remotestoragejs.readthedocs.io/en/latest/js-api.html)
    * [Usage with Node.js](https://remotestoragejs.readthedocs.io/en/latest/nodejs.html)
* Ask questions on the [community forums](https://community.remotestorage.io/)
* Ask questions on IRC in [#remotestorage on Freenode](irc://irc.freenode.net:7000/remotestorage)
  (wait a bit, if nobody's responding right away)
* If you found a potential bug, or want to propose a change, [open an issue on
  GitHub](https://github.com/remotestorage/remotestorage.js/issues). New issues
  will usually receive a response within 24-48 hours.

### Running a local test server

To develop remoteStorage-enabled apps, you need to have a
remoteStorage-compatible storage account. We recommend
[php-remote-storage](https://github.com/fkooman/php-remote-storage) (PHP) or
[mysteryshack](https://github.com/untitaker/mysteryshack) (Rust) for running a
local test server, or for self-hosting an RS server.

You can also get an account with a hoster, or use one of the various other
remoteStorage server implementations: [Servers](https://wiki.remotestorage.io/Servers).

### Developing, Contributing

remoteStorage.js is a grassroots project, developed by the community, for the
community. We'd be happy to count you among the many [people who
contributed](https://github.com/remotestorage/remotestorage.js/graphs/contributors)
to the project so far!

Read our [Contributing docs](https://remotestoragejs.readthedocs.io/en/latest/contributing.html)
to get started.

### Versioning

We adhere to [Semantic Versioning](http://semver.org/). This means that
breaking changes will result in a new major version. With npm, you can make
sure to only automatically upgrade to API-compatible versions by using either
the `^` prefix, or `x` as indicator for flexible numbers:

```js
"devDependencies": {
  "remotestoragejs": "1.x" // same as "^1.0.0"
}
```

### Credits

Original authors: Niklas Cathor, Michiel de Jong

See [list of all contributors](https://github.com/remotestorage/remotestorage.js/graphs/contributors)

Sponsored by [NLnet](https://nlnet.nl)

[![NLnet Logo](http://sockethub.org/res/img/nlnet-logo.svg)](https://nlnet.nl)
