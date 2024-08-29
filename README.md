# remoteStorage.js

[![npm](https://img.shields.io/npm/v/remotestoragejs.svg)](https://www.npmjs.com/package/remotestoragejs)
[![Build Status](https://github.com/remotestorage/remotestorage.js/actions/workflows/test-and-lint.yml/badge.svg)](https://github.com/remotestorage/remotestorage.js/actions/workflows/test-and-lint.yml?query=branch%3Amaster)

remoteStorage.js is a JavaScript library for storing user data locally in the
browser, as well as connecting to [remoteStorage](http://remotestorage.io)
servers and syncing data across devices and applications. It is also capable of
connecting and syncing data with a person's Dropbox, Google Drive or Solid
account (optional).

The library is well-tested and actively maintained. It is safe to use in
production.

### Where to get help?

* See [remotestorage.io](http://remotestorage.io/) for general information
  about the remoteStorage protocol
* Read [the docs](https://remotestorage.io/rs.js/docs/) (source files in `docs/`)
    * [Why use this?](https://remotestorage.io/rs.js/docs/why.html)
    * [Getting started](https://remotestorage.io/rs.js/docs/getting-started/)
    * [Data modules](https://remotestorage.io/rs.js/docs/data-modules/)
    * [JavaScript API](https://remotestorage.io/rs.js/docs/api/remotestorage/classes/RemoteStorage.html)
    * [Usage with Node.js](https://remotestorage.io/rs.js/docs/nodejs.html)
* Ask questions on the [community forums](https://community.remotestorage.io/)
* If you found a potential bug, or want to propose a change, [open an issue on
  GitHub](https://github.com/remotestorage/remotestorage.js/issues). New issues
  will usually receive a response within 24-48 hours.

### Running a local test server

To develop remoteStorage-enabled apps, you need to have a
remoteStorage-compatible storage account. We recommend
[php-remote-storage](https://github.com/fkooman/php-remote-storage) (PHP), or
[armadietto](https://github.com/remotestorage/armadietto) (node.js), or
[mysteryshack](https://github.com/untitaker/mysteryshack) (Rust) for running a
local test server, or for self-hosting an RS server.

You can also get an account with a hoster, or use another
remoteStorage server implementation: [Servers](https://wiki.remotestorage.io/Servers).

### Visual File Browser

If you'd like a visual UI for inspecting any RS-compatible account, you can use the [RS Inspektor](https://gitea.kosmos.org/raucao/inspektor) app (which is also implemented using this library).

### Developing, Contributing

remoteStorage.js is a grassroots project, developed by the community, for the
community. We'd be happy to count you among the many [people who
contributed](https://github.com/remotestorage/remotestorage.js/graphs/contributors)
to the project so far!

Read our [Contributing docs](https://remotestorage.io/rs.js/docs/contributing/)
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

Previously sponsored by [NLnet](https://nlnet.nl)

[![NLnet Logo](http://sockethub.org/res/img/nlnet-logo.svg)](https://nlnet.nl)
