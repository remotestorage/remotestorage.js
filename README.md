# remoteStorage.js
This is a library for adding remoteStorage support to your client-side app. See http://tutorial.unhosted.5apps.com/ for example usage.

## Code example
Minimal HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="./path/to/require.js"></script>
    <script src="./path/to/your/app.js"></script>
  </head>
  <body></body>
</html>
```

Your `app.js`:

```js
require(['./path/to/remoteStorage'], function(remoteStorage) {
  remoteStorage.getStorageInfo('user@example.com', function(err, storageInfo) {
    var token = remoteStorage.receiveToken();
    if(token) {
      //we can access the 'notes' category on the remoteStorage of user@example.com:
      var client = remoteStorage.createClient(storageInfo, 'notes', bearerToken);
      client.put('foo', 'bar', function(err) {
        client.get('foo', function(err, data) {
          client.delete('foo', function(err) {
          });
        });
      });
    } else {
      //get an access token for 'notes' by dancing OAuth with the remoteStorage of user@example.com:
      window.location = remoteStorage.createOAuthAddress(storageInfo, ['notes'], window.location.href);
    }
  });
});
```

## Function reference
### remoteStorage.getStorageInfo(userAddress, callback)

    userAddress: string of the form 'user@host'
    callback: function(err, storageInfo)
    -err: null, or a string describing what went wrong
    -storageInfo: an object describing some details of the user's remoteStorage

### remoteStorage.createOAuthAddress(storageInfo, categories, redirectUri)

    storageInfo: the object you got from the getStorageInfo call
    categories: an array of strings describing categories of data you will be accessing.
    @returns: string, the url you should go to for the OAuth dance
See https://github.com/unhosted/website/wiki/categories for a list of categories you might want to access.

### remoteStorage.receiveToken()

    @returns: when coming back from the OAuth dance, a string containing the bearer token. Otherwise, null.

### remoteStorage.createClient(storageInfo, category, bearerToken)

    storageInfo: the object you got from the getStorageInfo call
    category: one of the strings from the array you passed to createOAuthAddress earlier
    @returns: a Client

### Client.get(key, callback)
    
    key: a string, identifying which element you want to retrieve
    callback: function(err, data)
    -err: null, or a string describing what went wrong
    -data: undefined, or a string, that is the current value of 'key' within 'category' on the user's remoteStorage

#### Client.put(key, value, callback)

    key: a string, identifying which element you want to assign value to
    value: a string you want to assign to the element identified by key
    data: a string that, if successful, will be the new value of 'key' within 'category' on the user's remoteStorage
    callback: function(err)
    -err: null, or a string describing what went wrong

### Client.delete(key, callback)

    key: a string, identifying which element you want to reset to undefined
    callback: function(err)
    -err: null, or a string describing what went wrong

## Browser support
This library relies heavily on [CORS](http://caniuse.com/#search=cors).

Known to work: Firefox, Chrome, Safari, Safari iOS.

Might work: Firefox Mobile, Android stock browser, Opera 12+, Opera Mobile 12+, IE 10+.

Planned: IE 8 & 9 (please [help with this](https://groups.google.com/d/topic/unhosted/Xk1hJMr9i9c/discussion)!).

## Version and license
This is version 0.4.6 of the library, and you can use it under AGPL or MIT license - whatever floats your boat. Pull requests are very welcome (if you're not on github you can email them to michiel at unhosted.org).

## Download
https://github.com/unhosted/remoteStorage.js/blob/master/downloads/remoteStorage-0.4.6.tgz
