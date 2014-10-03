The code of remotestorage.js consists of files in the `src/` folder
of this repo. It is built by the Makefile, mainly by the node scripts
in the `build/` folder of this repo. The tests are in the `test/` folder.

The build process concatenates all the files together, and then adds a call:

````js
  remoteStorage = new RemoteStorage();
````

at the end. That is how `release/head/remotestorage.js` is created. There is
also a minified build, one without caching functionality (see `build/components.js`),
and a node build (see [nodejs-client.md](nodejs-client.md) in this `doc/` folder).

The structure of the code is based around feature loading. Most files in `src/` correspond
to a feature, e.g. `RemoteStorage.Discover` or `RemoteStorage.Caching`.

The feature loading happens synchronously during the page load in `src/remotestorage.js`
(just including the script in your app will lead to executing the code that loads the features).

Most feature load under their own name, but for `remoteStorage.local` a choice is made between
`RemoteStorage.IndexedDB`, `RemoteStorage.LocalStorage` and `RemoteStorage.InMemoryCaching`.

For `remoteStorage.local` we then also have a
[special mixin](https://github.com/remotestorage/remotestorage.js/issues/777#issuecomment-57392440)
called `src/cachinglayer.js`, which mixes in some common functions into the object.

The `remoteStorage.remote` feature is not loaded immediately, but only when `RemoteStorage.Discover`
calls `remoteStorage.setBackend`, and then a choice is made between `RemoteStorage.WireClient`,
`RemoteStorage.GoogleDrive`, `RemoteStorage.Dropbox`, etcetera (we aim to add more backends in the future).
