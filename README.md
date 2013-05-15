# remoteStorage.js

[![Build Status](https://secure.travis-ci.org/remotestorage/remotestorage.js.png)](http://travis-ci.org/remotestorage/remotestorage.js)

### Where to get help?

* Consult this README
* Read the Guides:
  * [Adding remoteStorage to your app](http://remotestorage.io/integrate/add-to-app.html)
  * [Howto contribute](http://remotestoragejs.com/doc/code/files2/howto-contribute-txt.html)
  * [Working with schemas](http://remotestoragejs.com/doc/code/files2/howto-include-txt.html)
  * [How to configure synchronization](http://remotestoragejs.com/doc/code/files/lib/sync-js.html#How_to_configure_sync)
* Consult the [API documentation](http://remotestoragejs.com/doc/code)
* Ask on the [forums](http://community.remotestorage.io/categories)
* Ask in the [IRC Channel](http://webchat.freenode.net/?channels=remotestorage) (#remotestorage on freenode)
* Open an issue in the relevant repository

### Running the local Test Server

To test remoteStorage enabled apps, you need to have a remoteStorage compatible storage account.
To find out how to get one, see [Get Storage on remotestorage.io](http://remotestorage.io/get/).

Additionally, remoteStorage.js brings a tiny example server for nodeJS.

* To run the test server, first of all add a line

    127.0.0.1 local.dev

* to your /etc/hosts file. then run:

    sudo node server/nodejs-example.js

* You can then connect as "me@local.dev"
