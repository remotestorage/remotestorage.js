# Loading data on app launch/startup

::: warning TODO
Unfinished doc
:::

In order to load data into memory during the startup of your app, usually by
creating your JavaScript framework's analog of model instances, there are
generally two different approaches with remoteStorage.js:

## Option 1: Relying solely on events

The first approach is to handle `local` events, then `remote` events

## Option 2: Use getAll(), then update via events

The second approach is to use the getAll function to load all relevant documents on
startup, and then use `remote` events to add, update, and remove items in memory when
updates are being received from the remote storage.
