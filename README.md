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

### Adding remotestorage.js v0.7.2 to your app:

* download "remotestorage.min.js" from http://remotestoragejs.com/release/0.7.2/remotestorage.min.js
* in index.html, include this script and any modules you plan to load:

```html
<script src="remotestorage.min.js"></script>
<!-- the modules can be found in the modules repository: https://github.com/remotestorage/modules -->
<script src="remotestorage-contacts.js"></script>
```

* claim access to the 'pictures' module, and display the widget:

```javascript
remoteStorage.claimAccess({ contacts: 'rw' })
remoteStorage.displayWidget();
```

* if your app can only be used while connected, then add this:

```javascript
remoteStorage.on('ready', function() {
  showApp();
});
remoteStorage.on('disconnect', function() {
  hideApp();
});
```

* in any case, update the DOM when changes come in (this is module specific):

```javascript
remoteStorage.contacts.on('change', function(event) {
  // handle change event
  event.origin; // -> "tab", "device" or "remote"
  event.path; // /contacts/card/... (absolute path)
  event.relativePath; // card/... (relative to the module root, i.e. /contacts/)
  event.oldValue; // the previous value stored at the path (or 'undefined', if there was no previous value)
  event.newValue; // the curretn value stored at the path (or 'undefined', if the change was a deletion)
});
```

* to handle conflicting changes, install a "conflict" handler as well (if you don't do this, changes on the server will win over local changes):

```javascript
remoteStorage.contacts.on('conflict', function(event) {
  // you have the following attributes:
  event.path;
  event.localValue;
  event.remoteValue;
  event.type; // either "delete" or "merge"
  // to resolve the conflict, call 'event.resolve' either now or in the future:
  event.resolve('local'); // take local version
  // OR
  event.resolve('remote'); // take remote version
});
```

#### see [example/minimal-0.7.0/index.html](https://github.com/remotestorage/remotestorage.js/blob/master/example/minimal-0.7.0/index.html) for a full example code.

### Running the local Test Server

To test remoteStorage enabled apps, you need to have a remoteStorage compatible storage account.
To find out how to get one, see [Get Storage on remotestorage.io](http://remotestorage.io/get/).

Additionally, remoteStorage.js brings a tiny example server for nodeJS.

* To run the test server, first of all add a line

    127.0.0.1 local.dev

* to your /etc/hosts file. then run:

    sudo node server/nodejs-example.js

* You can then connect as "me@local.dev"