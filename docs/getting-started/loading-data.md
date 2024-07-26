# Loading data on app launch/startup

In order to load data into memory (or the DOM) during the startup of your app,
there are generally two different approaches with remoteStorage.js:

## Option 1: Relying solely on events

Upon initialization, remoteStorage.js will emit [change
events](../api/baseclient/classes/BaseClient.html#change-events) events with
the origin `local` for all documents found in the local cache.

Consider for example the following [code from the example app My Favorite
Drinks](https://github.com/remotestorage/myfavoritedrinks/blob/master/app.js#L33-L37),
which uses them to display the stored items:

```js
remoteStorage.myfavoritedrinks.on('change', function(event) {
  if (event.newValue && (! event.oldValue)) {
    console.log('Change from '+event.origin+' (add)', event);
    displayDrink(event.relativePath, event.newValue.name);
  }
});
```

The benefit of this approach is that the app displays items loaded from the
local cache during app startup, as well as items synchronized from the remote
storage afterwards! "Feeding two birds with one scone", as they say.

Depending on your use case and app architecture, this means that there is no
need to distinguish between `local` and `remote` changes per se.

## Option 2: Use `getAll()`, then update via events

The second approach is to use the
[getAll()][1] function to load
all relevant documents on startup, and then use only `remote` change events to
add, update, and remove items when updates are being received from the remote
storage.

Consider this code example:

```js
const items = await client.getAll("/my-sub-folder");

for (const path in items) {
  renderItem(path, items[path]);
}

client.on('change', event => {
  if (event.newValue) {
    renderItem(path, items[path]);
  }
});
```

The benefit of this approach is that you can render all items at once, instead
of potentially flooding the screen with hundreds of items being added one by one as
they are loaded.

However, when doing it this way, you have to ensure to either only listen to
change events with origin `remote`, or to register the event listener _after_
you have loaded all available items with [getAll()][1].

::: tip
If you want [getAll()][1] to immediately return all locally cached items, and not
wait to check the remote storage for potential updates, set the optional `maxAge`
argument to `false`.
:::

[1]: ../api/baseclient/classes/BaseClient.html#getall
