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

## Handling bulk incoming changes

During a sync cycle, the library emits a separate `change` event for each
incoming item. If another device added 20 photos, your `change` handler fires
20 times during that cycle.

The most efficient approach is to handle each event individually — update a
single item in your UI state rather than reloading the full collection:

```js
client.on('change', event => {
  if (event.newValue) {
    addOrUpdateItem(event.relativePath, event.newValue);
  } else {
    removeItem(event.relativePath);
  }
});
```

::: warning Avoid calling getAll() in a change handler
Calling [getAll()][1] inside a `change` handler means rereading the entire local
cache on every incoming item. During a bulk sync this causes redundant reads
against a cache that is still being populated.
:::

If your app architecture requires reloading full collections (e.g. a reactive
store that replaces the entire items object), you can use `change` events as a
signal and defer the reload until the sync cycle completes:

```js
let hasChanges = false;

client.on('change', () => {
  hasChanges = true;
});

remoteStorage.on('sync-done', () => {
  if (hasChanges) {
    hasChanges = false;
    reloadFromCache(); // single getAll() call per cycle
  }
});
```

Note that `sync-done` fires at the end of every sync cycle — including idle
ones where nothing changed. The `hasChanges` flag ensures you only reload when
data has actually been updated.

[1]: ../api/baseclient/classes/BaseClient.html#getall
