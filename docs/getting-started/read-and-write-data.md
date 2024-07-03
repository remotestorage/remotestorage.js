# Reading and writing data

As soon as your [RemoteStorage][1] instance is ready for action (signaled by
the `ready` event), we can start reading and writing data.

## Anonymous mode

One of the unique features of rs.js is that users are not required to
have their storage connected in order to use the app; you can require
connecting storage if it fits your use case. Any data written locally is
automatically synced to the remote storage server when connecting an
account.

## Using BaseClient

A [BaseClient][2] instance is the main endpoint for interacting with
storage: listing, reading, creating, updating and deleting documents, as
well as handling change events.

::: warning TODO
Update paragraph, link directly to relevant section
:::
Check out the [BaseClient][2] in order
to learn about all functions available for reading and writing data and how to
use them.

There are two options for acquiring a [BaseClient][2] instance:

### Quick and dirty: creating a client via `scope()`

::: tip NOTE
This should mainly be used for manually exploring client functions and locally in
development.
:::

Using the [scope](../api/baseclient/classes/BaseClient.html#scope) method,
you can create a new [BaseClient][2] scoped to a given path:

```js
const client = remoteStorage.scope('/foo/');

// List all items in the "foo/" category/folder
client.getListing('').then(listing => console.log(listing));

// Write some text to "foo/bar.txt"
const content = 'The most simple things can bring the most happiness.';
client.storeFile('text/plain', 'bar.txt', content)
  .then(() => console.log("data has been saved"));
```

### The recommended way: using clients in data modules

The recommended way is to use the private and public [BaseClient][2] instances,
which are available in so-called [data modules](../data-modules). Continue to
the next section in order to learn about them.

[1]: ../api/remotestorage/classes/RemoteStorage.html
[2]: ../api/baseclient/classes/BaseClient.html
