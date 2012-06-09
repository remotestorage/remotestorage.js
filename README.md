# remoteStorage.js

A library for adding remoteStorage support to your client-side app. See [the tutorial](http://tutorial.unhosted.5apps.com) for example usage and [download](https://github.com/unhosted/remoteStorage.js/raw/master/build/latest/remoteStorage.js) the library. To use, check out 'master'. To contribute, check out '0.7' (but come to #unhosted on freenode or email michiel at unhosted.org first, so we can coordinate).

## Code example

Include remoteStorage.js in your HTML (before the app.js which calls it):

```html
<script src="path/to/remoteStorage.js"></script>
<script src="path/to/your/app.js"></script>
```

Your `app.js`:

```js
remoteStorage.getStorageInfo('user@example.com', function(err, storageInfo) {
  var token = remoteStorage.receiveToken();
  if(token) {
    //we can access the 'notes' category on the remoteStorage of user@example.com:
    var client = remoteStorage.createClient(storageInfo, 'notes', token);
    client.put('key', 'value', function(err) {
      client.get('key', function(err, data) {
        client.delete('key', function(err) {
        });
      });
    });
  } else {
    //get an access token for 'notes' by dancing OAuth with the remoteStorage of user@example.com:
    window.location = remoteStorage.createOAuthAddress(storageInfo, ['notes'], window.location.href);
  }
});
```

## Function reference
### remoteStorage.getStorageInfo(userAddress, callback)

    userAddress: string of the form 'user@host'
    callback: function(err, storageInfo)
    -err: null, or a string describing what went wrong
    -storageInfo: an object describing some details of the user's remoteStorage

### remoteStorage.createOAuthAddress(storageInfo, scopes, redirectUri)

    storageInfo: the object you got from the getStorageInfo call
    scopes: an array of strings of form path+':r' or path+':rw', describing scopes you will be accessing.
    @returns: string, the url you should go to for the OAuth dance
See [the list of categories](https://github.com/unhosted/website/wiki/categories) you might want to access.

### remoteStorage.receiveToken()

    @returns: when coming back from the OAuth dance, a string containing the bearer token. Otherwise, null.

### remoteStorage.createClient(storageInfo, basePath, bearerToken)

    storageInfo: the object you got from the getStorageInfo call
    basePath: string, should be a (sub-)directory from the scopes-array you passed to createOAuthAddress earlier
    @returns: a Client

### Client.get(relPath, callback)
    
    relPath: string, such that basePath+'/'+relPath is the element you want to retrieve
    callback: function(err, data)
    -err: null, or a string describing what went wrong
    -data: undefined, or a string, that is the current value of 'key' within 'category' on the user's remoteStorage

#### Client.put(relPath, value, callback)

    relPath: string, such that basePath+'/'+relPath is the element you want to assign a value to
    value: a string you want to assign to the element identified by key
    data: a string that, if successful, will be the new value of 'key' within 'category' on the user's remoteStorage
    callback: function(err)
    -err: null, or a string describing what went wrong

### Client.delete(relPath, callback)

    relPath: string, such that basePath+'/'+relPath is the element you want to reset to undefined
    callback: function(err)
    -err: null, or a string describing what went wrong

## Browser support
This library relies heavily on [CORS (Cross-Origin Resource Sharing)](http://caniuse.com/#search=cors).

Known to work: Firefox, Chrome, Safari, Safari iOS.

Might work: Firefox Mobile, Android stock browser, Opera 12+, Opera Mobile 12+, IE 10+.

Planned: IE 8 & 9 (please [help with this](https://groups.google.com/d/topic/unhosted/Xk1hJMr9i9c/discussion)!).

## Version and license
This is version 0.5.6 of the library, and you can use it under AGPL or MIT license - whatever floats your boat. Pull requests are very welcome (if you're not on github you can email them to michiel at unhosted.org). To build:

    cd build
    node build.js

