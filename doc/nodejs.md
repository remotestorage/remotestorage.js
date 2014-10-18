#  Using remotestorage.js in node.js

Although remotestorage.js was initially written to focus being used within  a browser, we do support using it within a node.js environment as well. Keep in mind that this is an ongoing process which we hope to continue to make improvements upon. If you find any issues, please let us know by filing an issue [here](https://github.com/RemoteStorage/remotestorage.js/issues).

## Installation

#### base library

First you should install the remotestorage node package, which is named `remotestoragejs` (no `.` before `js`).

`~project$ npm install --save remotestoragejs`

#### module

Currently the remotestorage.js modules are not packaged as part of the `remotestoragejs` npm module. So you will need to download (or create) your own module to use. You can visit our [modules repository](https://github.com/RemoteStorage/modules) to see existing modules, feel free to submit a pull request if you've written your own.

For this example, let's use the [feeds module](https://github.com/remotestorage/modules/blob/master/src/feeds.js).

Download a copy of this module and place it in your project somewhere, let's say `src/remotestorage-feeds.js` for the purpose of this document.

## Initialization

The initialization process for creating an instance of RemoteStorage is as follows.

#### create

```javascript
    var RemoteStorage = require('remotestoragejs');
    var remoteStorage = new RemoteStorage({
        logging: true  // optinally enable debug logs (defaults to false)
    });
```


#### global

At this time, there are still some browser-specific requirements within the library that require us (for the time-being) to place our newly created remoteStorage object into nodes global scope. This is so our modules can access the object as they currently expect to do (we hope to address this issue soon).

```javascript
    global.remoteStorage = remoteStorage;
```


#### on ready

Now we can hook up to the `'ready'` event which will be called once our library has initialized.

```javascript
    remoteStorage.on('ready', beginApp);
```

We will make the function `beginApp()` shortly.

## Configuring a remote

In order to use a remote, you will need a webfinger user address and an oauth token for the desired module. You will need to provide these two values on your own outside of the program script, for example in an already authorized web-app which uses the module you'd like to use here. Within the web-app you should be able to inspect the `remoteStorage.remote.token`.

```javascript
    var userAddress = ''; // fill me in
    var token = ''; // fill me in
    
    RemoteStorage.Discover(userAddress, function (storageURL, storageAPI) {
        console.log('- configuring remote', userAddress, storageURL, storageAPI);
        remoteStorage.remote.configure(userAddress, storageURL, storageAPI, token);
    });
```

#### on connected

Although you can start using remoteStorage as soon as the ready event files, these events tell us whether/when we've connected to the remote storage target. When we've connected, all changes we make will be automatically synced with our remote.

```javascript
    remoteStorage.on('connected', function() {
        console.log('- connected to remote (syncing will take place)');
    });

    remoteStorage.on('not-connected', function() {
        console.log('- not connected to remote (changes are local-only)');
    });
```    


## Module

#### include

Now let's include our `feeds` module. If the file was placed in our project as `src/remotestorage-feeds.js`, then this is how we'd include it.

```javascript
    require('./src/remotestorage-feeds.js');
```

Currently the modules attach themselves to the global `remotesStorage` object directly, which is why we needed to make it global earlier.

#### claim access

We'll need to claim access to our module in order to use it:

```javascript
    remoteStorage.access.claim('feeds', 'rw');
```

#### on change

To become alerted to our modules change event's (which occurs when our module data has been updated either locally or remotely), we do the following.

```javascript
    remoteStorage.feeds.rssAtom.on('change', function (event) {
        console.log('- received change event: ', event);
    });
```


## Using our module

Now that all of the initialization is in place, let's create the function which will be called when `remoteStorage` fires the `'ready'` event.

```javascript
    function beginApp {
        // create a feed record
        remoteStorage.feeds.rssAtom.create({
            url: 'testurl',
            title: 'this is a test'
        })
        .then(function (feed) {
            console.log('- feed created ', feed);

            // retrieve all feeds
            remoteStorage.feeds.rssAtom.getAll()
            .then(function (feeds) {
                console.log('- all feeds', feeds);
            }, function (error) {
                console.log('*** error fetching all feeds', error);
            });
        });
    }
```


## Complete script

Here's our final script.

```javascript
// initialize remoteStorage
var RemoteStorage = require('remotestoragejs');
var remoteStorage = new RemoteStorage({
    logging: true  // optinally enable debug logs (defaults to false)
});
global.remoteStorage = remoteStorage;

remoteStorage.on('ready', beginApp);

// configure remote
var userAddress = ''; // fill me in
var token = ''; // fill me in
    
RemoteStorage.Discover(userAddress, function (storageURL, storageAPI) {
    console.log('- configuring remote', userAddress, storageURL, storageAPI);
    remoteStorage.remote.configure(userAddress, storageURL, storageAPI, token);
});

remoteStorage.on('connected', function() {
  console.log('- connected to remote (syncing will take place)');
});

remoteStorage.on('not-connected', function() {
  console.log('- not connected to remote (changes are local-only)');
});

// initialize module
require('./src/remotestorage-feeds.js');
remoteStorage.access.claim('feeds', 'rw');

remoteStorage.feeds.rssAtom.on('change', function (event) {
    console.log('- received change event: ', event);
});

function beginApp() {
    // create a feed record
    remoteStorage.feeds.rssAtom.create({
        url: 'testurl',
        title: 'this is a test'
    })
    .then(function (feed) {
        console.log('- feed created ', feed);
        // retrieve all feeds
        remoteStorage.feeds.rssAtom.getAll()
        .then(function (feeds) {
            console.log('- all feeds', feeds);
        }, function (error) {
            console.log('*** error fetching all feeds', error);
        });
    });
}
```


