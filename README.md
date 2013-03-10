# remoteStorage.js

[![Build Status](https://secure.travis-ci.org/remotestorage/remotestorage.js.png)](http://travis-ci.org/remotestorage/remotestorage.js)

### Where to get help?

* Consult this README
* Read the Guides:
  * [Adding remoteStorage to your app](http://remotestoragejs.com/doc/code/files2/howto-include-txt.html)
  * [Howto contribute](http://remotestoragejs.com/doc/code/files2/howto-contribute-txt.html)
  * [Working with schemas](http://remotestoragejs.com/doc/code/files2/howto-include-txt.html)
  * [How to configure synchronization](http://remotestoragejs.com/doc/code/files/lib/sync-js.html#How_to_configure_sync)
* Consult the [API documentation](http://remotestoragejs.com/doc/code)
* Ask in the [IRC Channel](http://webchat.freenode.net/?channels=remotestorage) (#remotestorage on freenode)
* Open an issue for discussion, either in the relevant repository or [the website repo for general discussion](https://github.com/remotestorage/remotestorage.io/issues)

### Adding remoteStorage.js v0.7 to your app:

#### add "remoteStorage-modules.min.js" (you can download it from http://remotestoragejs.com/release/0.7.0/remoteStorage-modules.min.js)
#### in index.html, include this script and any modules you plan to load:

    <script src="remoteStorage-modules.js"></script>

#### at the beginning of the document body, add a div:

    <div id="remotestorage-connect"></div>

#### claim access to for instance the 'notes' module, and display the widget:

    remoteStorage.claimAccess({notes: 'rw'}).then(function() {
      remoteStorage.displayWidget('remotestorage-connect');
      ...
    });

#### if your app can only be used while connected, then add this on the '...':

      remoteStorage.onWidget('ready', function() {
        showApp();
      });
      remoteStorage.onWidget('disconnect', function() {
        hideApp();
      });

#### in any case, update the DOM when changes come in. This is module-specific:

      remoteStorage.notes.onChange(function() {
        redrawApp();
      });

#### see [example/minimal-0.7.0/index.html](https://github.com/remotestorage/remotestorage.js/blob/master/example/minimal-0.7.0/index.html) for the full example code.

### Running the local Test Server

To test remoteStorage enabled apps, you need to have a remoteStorage compatible storage account.
To find out how to get one, see [Get Storage on remotestorage.io](http://remotestorage.io/get/).

Additionally, remoteStorage.js brings a tiny example server for nodeJS.

#### To run the test server, first of all add a line

    127.0.0.1 local.dev

#### to your /etc/hosts file. then run:

    sudo node server/nodejs-example.js

