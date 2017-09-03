BaseClient
==========

TODO explain:

* usually used in modules, given as argument to the builder function (public
  plus private)
* can also be created on the fly using remoteStorage#scope

Data read/write operations
--------------------------

A ``BaseClient`` deals with three types of data: folders, objects and files:

* :func:`getListing` returns a mapping of all items within a folder.

* :func:`getObject` and :func:`storeObject` operate on JSON objects. Each object
  has a type.

* :func:`getFile` and :func:`storeFile` operates on files. Each file has a MIME
  type.

* :func:`getAll` returns all objects or files for the given folder path.

* :func:`remove` operates on either objects or files (but not folders; folders
  are created and removed implictly).

.. _max-age:

Caching logic for read operations
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

All functions requesting/reading data will immediately return data from the
local store, *as long as it is reasonably up-to-date*. The default maximum age
of requested data is two times the periodic sync interval (10 seconds by
default).

However, you can adjust this behavior by using the `maxAge` argument with any
of these functions, thereby changing the maximum age or removing the
requirement entirely:

* If the ``maxAge`` requirement is set, and the last sync request for the path
  is further in the past than the maximum age given, the folder will first be
  checked for changes on the remote, and then the promise will be fulfilled
  with the up-to-date folder listing.

* If the ``maxAge`` requirement cannot be met because of network problems,
  the promise will be rejected.

* If the ``maxAge`` requirement is set to ``false``, or the library is in
  offline mode (TODO link this), or no remote storage is connected (a.k.a.
  "anonymous mode"), the promise will always be fulfilled with data from the
  local store.

.. HINT::
   If caching for the folder is turned off, none of this applies and data will
   always be requested from the remote store directly.

List of functions
^^^^^^^^^^^^^^^^^

.. autofunction:: BaseClient#getListing
  :short-name:

  Example usage:

  .. code:: javascript

     client.getListing('')
           .then(listing => console.log(listing));

  The folder listing is returned as a JSON object, with the root keys
  representing the pathnames of child nodes. Keys ending in a forward slash
  represent *folder nodes* (subdirectories), while all other keys represent
  *data nodes* (files/objects).

  Data node information contains the item's ETag, content type and -length.

  Example of a listing object:

  .. code:: javascript

     {
       "@context": "http://remotestorage.io/spec/folder-description",
       "items": {
         "thumbnails/": true,
         "screenshot-20170902-1913.png": {
           "ETag": "6749fcb9eef3f9e46bb537ed020aeece",
           "Content-Length": 53698,
           "Content-Type": "image/png;charset=binary"
         },
         "screenshot-20170823-0142.png": {
           "ETag": "92ab84792ef3f9e46bb537edac9bc3a1",
           "Content-Length": 412401,
           "Content-Type": "image/png;charset=binary"
         }
       }
     }

.. autofunction:: BaseClient#getObject
  :short-name:

  Example:

  .. code:: javascript

     client.getObject('/path/to/object')
           .then(obj => console.log(obj));

.. autofunction:: BaseClient#getAll
  :short-name:

  Example response object:

  .. code:: javascript

     // TODO

  For items that are not JSON-stringified objects (e.g. stored using
  `storeFile` instead of `storeObject`), the object's value is filled in
  with `true`.

  Example usage:

  .. code:: javascript

     client.getAll('').then(objects => {
       for (var path in objects) {
         console.log(path, objects[path]);
       }
     });

.. autofunction:: BaseClient#getFile
  :short-name:

  The response object contains two properties:

  .. table::

     ============ ============================================================
     ``mimeType`` String representing the MIME Type of the document.
     ``data``     Raw data of the document (either a string or an ArrayBuffer)
     ============ ============================================================

  Example usage (displaying an image):

  .. code:: javascript

     client.getFile('path/to/some/image').then(file => {
       var blob = new Blob([file.data], { type: file.mimeType });
       var targetElement = document.findElementById('my-image-element');
       targetElement.src = window.URL.createObjectURL(blob);
     });

Other functions
---------------

.. autofunction:: BaseClient#scope
  :short-name:
