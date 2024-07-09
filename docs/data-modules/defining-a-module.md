# Defining a module

A data module is just a JavaScript object containing a module name and a
builder function.

The builder function receives two [BaseClient][2] instances when loaded: one
for private data stored in `/my-module-name/` and one for public data stored in
`/public/my-module-name/`. A module must return an object, with the properties
and functions to be used in an app as `exports`:

``` javascript
const Bookmarks = { name: 'bookmarks', builder: function(privateClient, publicClient) {
  return {
    exports: {
      addBookmark: function() {}
    }
  }
}};
```

You can then load the module into your [RemoteStorage][1] instance, either on
initialization or later using the `addModule()` function:

```js
const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });

// or later:
remoteStorage.addModule(Bookmarks);
```

The module will then be accessible on the instance by its name, allowing
you to call the functions and properties that it exports:

```js
remoteStorage.bookmarks.addBookmark()
```

[1]: ../api/remotestorage/classes/RemoteStorage.html
[2]: ../api/baseclient/classes/BaseClient.html
