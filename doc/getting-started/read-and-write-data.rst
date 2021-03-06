Reading and writing data
========================

As soon as your :doc:`RemoteStorage </js-api/remotestorage>` instance is ready
for action (signaled by the ``ready`` event), we can start reading and writing
data.

"Anonymous mode"
----------------

One of the unique features of rs.js is that users are not required to have
their storage connected in order to use the app; you can require connecting
storage if it fits your use case. Any data written locally is automatically
synced to the remote storage server when connecting an account.

Using BaseClient
----------------

A ``BaseClient`` instance is the main endpoint for interacting with storage:
listing, reading, creating, updating and deleting documents, as well as
handling change events.

Check out the :doc:`BaseClient API docs </js-api/base-client>` in order to
learn about all functions available for reading and writing data and how to use
them.

There are two options for acquiring a BaseClient instance:

Quick and dirty: creating a client via ``scope()``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This should mainly be used for manually exploring client functions and in
development. Using :func:`scope`, you can create a new BaseClient scoped to a
given path::

   const client = remoteStorage.scope('/foo/');

   // List all items in the "foo/" category/folder
   client.getListing('')
     .then(listing => console.log(listing));

   // Write some text to "foo/bar.txt"
   const content = 'The most simple things can bring the most happiness.'
   client.storeFile('text/plain', 'bar.txt', content)
     .then(() => console.log("data has been saved"));

The recommended way: using clients in data modules
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The recommended way is to use the private and public ``BaseClient`` instances,
which are available in so-called :doc:`data modules </data-modules>`. Continue
to the next section in order to learn about them.

.. rubric:: Footnotes
