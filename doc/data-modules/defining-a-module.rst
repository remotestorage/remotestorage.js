Defining a module
=================

A data module is just a JavaScript object containing a module name and a
builder function.

The builder function receives two :doc:`base clients </js-api/base-client>`
when loaded: one for private data stored in ``/my-module-name/`` and one for
public data stored in ``/public/my-module-name/``. It must return an object,
defining the properties and functions to be used in the app as ``exports``:

.. CODE:: javascript

   var Bookmarks = { name: 'bookmarks', builder: function(privateClient, publicClient) {
     return {
       exports: {
        addBookmark: function() {}
       }
     }
   }};

You can then load it into your :doc:`RemoteStorage </js-api/remotestorage>`
instance either on initialization, or later using the ``addModule()`` function::

   const remoteStorage = new RemoteStorage({ modules: [ Bookmarks ] });

   // or later:

   remoteStorage.addModule(Bookmarks);

It will then be available on the instance as its module name, allowing you to
call the functions and properties that the module exports::

   remoteStorage.bookmarks.addBookmark();
