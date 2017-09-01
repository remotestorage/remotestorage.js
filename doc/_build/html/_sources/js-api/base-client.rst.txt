BaseClient
==========

A BaseClient deals with three types of data: folders, objects and files.

<getListing> returns a mapping of all items within a folder. Items that
end with a forward slash ("/") are child folders. For instance:

.. code:: javascript

   {
     'folder/': true,
     'document.txt': true
   }

`getObject </js-api/base-client.html#getObject>`_ and <storeObject> operate on
JSON objects. Each object has a type.

<getFile> and <storeFile> operates on files. Each file has a MIME type.

<remove> operates on either objects or files (but not folders, folders are
created and removed implictly).

Object operations
-----------------

.. autofunction:: BaseClient#getObject
  :short-name:

  Example:

  .. code:: javascript

     client.getObject('/path/to/object', false).
       then(function (object) {
         // object is either an object or null
       });
