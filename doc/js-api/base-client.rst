BaseClient
==========

A ``BaseClient`` instance is the main endpoint you will use for interacting
with a connected storage: listing, reading, creating, updating and deleting
documents, as well as handling incoming changes.

Base clients are usually used in :doc:`data modules </data-modules>`, which are
loaded with two ``BaseClient`` instances by default: one for private and one for
public documents.

However, you can also instantiate a BaseClient outside of a data module using
the ``remoteStorage.scope()`` function. Similarly, you can create a new scoped
client within another client, using the ``BaseClient``'s own :func:`scope`.

.. contents::

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

However, you can adjust this behavior by using the ``maxAge`` argument with any
of these functions, thereby changing the maximum age or removing the
requirement entirely.

* If the ``maxAge`` requirement is set, and the last sync request for the path
  is further in the past than the maximum age given, the folder will first be
  checked for changes on the remote, and then the promise will be fulfilled
  with the up-to-date document or listing.

* If the ``maxAge`` requirement is set, and cannot be met because of network
  problems, the promise will be rejected.

* If the ``maxAge`` requirement is set to ``false``, or the library is in
  offline mode, or no remote storage is connected (a.k.a.  "anonymous mode"),
  the promise will always be fulfilled with data from the local store.

.. HINT::
   If :doc:`caching </js-api/caching>` for the folder is turned off, none of
   this applies and data will always be requested from the remote store
   directly.

List of functions
^^^^^^^^^^^^^^^^^

.. autofunction:: BaseClient#getListing(path, maxAge)
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

  .. WARNING::
     At the moment, this function only returns detailed metadata, when caching
     is turned off (``new RemoteStorage({cache: false})``). With caching turned
     on, it will only contain the item names as properties with ``true`` as
     value. See issues :issue:`721` and :issue:`1108` — contributions
     welcome!

.. autofunction:: BaseClient#getObject(path, maxAge)
  :short-name:

  Example:

  .. code:: javascript

     client.getObject('/path/to/object')
           .then(obj => console.log(obj));

.. autofunction:: BaseClient#storeObject(typeAlias, path, object)
  :short-name:

  Example:

  .. code:: javascript

     var bookmark = {
       url: 'http://unhosted.org',
       description: 'Unhosted Adventures',
       tags: ['unhosted', 'remotestorage', 'no-backend']
     }
     var path = MD5Hash(bookmark.url);

     client.storeObject('bookmark', path, bookmark)
           .then(() => console.log('bookmark saved'))
           .catch((err) => console.log(err));

.. autofunction:: BaseClient#getAll(path, maxAge)
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

.. autofunction:: BaseClient#getFile(path, maxAge)
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

.. autofunction:: BaseClient#storeFile(mimeType, path, body)
  :short-name:

  Example (UTF-8 data):

  .. code:: javascript

     client.storeFile('text/html', 'index.html', '<h1>Hello World!</h1>')
           .then(() => { console.log("Upload done") });

  Example (Binary data):

  .. code:: javascript

     var input = document.querySelector('form#upload input[type=file]');
     var file = input.files[0];
     var fileReader = new FileReader();

     fileReader.onload = function () {
       client.storeFile(file.type, file.name, fileReader.result)
             .then(() => { console.log("Upload done") });
     };

     fileReader.readAsArrayBuffer(file);

.. autofunction:: BaseClient#remove(path)
  :short-name:

  Example:

  .. code:: javascript

     client.remove('path/to/object')
           .then(() => console.log('item successfully deleted'));

Change events
-------------

``BaseClient`` offers a single event, named ``change``, which you can add a
handler for using the ``.on()`` function (same as in ``RemoteStorage``):

.. code:: javascript

   client.on('change', function (evt) {
     console.log('data was added, updated, or removed:', evt)
   });

Using this event, you can stay informed about data changes, both remote (from
other devices or browsers), as well as locally (e.g. other browser tabs).

In order to determine where a change originated from, look at the ``origin``
property of the incoming event. Possible values are ``window``, ``local``,
``remote``, and ``conflict``, explained in detail below.

Example:

.. code:: javascript

   {
     // Absolute path of the changed node, from the storage root
     path: path,
     // Path of the changed node, relative to this baseclient's scope root
     relativePath: relativePath,
     // See origin descriptions below
     origin: 'window|local|remote|conflict',
     // Old body of the changed node (local version in conflicts; undefined if creation)
     oldValue: oldBody,
     // New body of the changed node (remote version in conflicts; undefined if deletion)
     newValue: newBody,
     // Old contentType of the changed node (local version for conflicts; undefined if creation)
     oldContentType: oldContentType,
     // New contentType of the changed node (remote version for conflicts; undefined if deletion)
     newContentType: newContentType
   }

``local``
^^^^^^^^^

Events with origin ``local`` are fired conveniently during the page load, so
that you can fill your views when the page loads.

Example:

.. code:: javascript

   {
     path: '/public/design/color.txt',
     relativePath: 'color.txt',
     origin: 'local',
     oldValue: undefined,
     newValue: 'white',
     oldContentType: undefined,
     newContentType: 'text/plain'
   }

.. HINT::
   You may also use for example :func:`getAll` instead, and choose to
   deactivate these.

``remote``
^^^^^^^^^^

Events with origin ``remote`` are fired when remote changes are discovered
during sync.

.. NOTE::
   Automatically receiving remote changes depends on the :doc:`caching
   </js-api/caching>` settings for your module/paths.

``window``
^^^^^^^^^^

Events with origin `window` are fired whenever you change a value by calling a
method on the ``BaseClient``; these are disabled by default.

.. HINT::
   You can enable them by configuring ``changeEvents`` for your
   :doc:`RemoteStorage </js-api/remotestorage>` instance.

``conflict``
^^^^^^^^^^^^

Events with origin ``conflict`` are fired when a conflict occurs while pushing
out your local changes to the remote store.

Say you changed 'color.txt' from 'white' to 'blue'; if you have set
``config.changeEvents.window`` to ``true`` (by passing it to the
``RemoteStorage`` constructor, see the Constructor section of the
:doc:`RemoteStorage API doc </js-api/remotestorage>`), then you will receive:

.. code:: javascript

   {
      path: '/public/design/color.txt',
      relativePath: 'color.txt',
      origin: 'window',
      oldValue: 'white',
      newValue: 'blue',
      oldContentType: 'text/plain',
      newContentType: 'text/plain'
    }

But when this change is pushed out by asynchronous synchronization, this change
may be rejected by the server, if the remote version has in the meantime changed
from 'white' to  for instance 'red'; this will then lead to a change event with
origin 'conflict' (usually a few seconds after the event with origin 'window',
if you have those activated). Note that since you already changed it from
'white' to 'blue' in the local version a few seconds ago, ``oldValue`` is now
your local value of 'blue':

.. code:: javascript

   {
      path: '/public/design/color.txt',
      relativePath: 'color.txt',
      origin: 'conflict',
      oldValue: 'blue',
      newValue: 'red',
      oldContentType: 'text/plain',
      newContentType: 'text/plain',
      // Most recent known common ancestor body of local and remote
      lastCommonValue: 'white',
      // Most recent known common ancestor contentType of local and remote
      lastCommonContentType: 'text/plain'
    }

Data types
----------

.. autofunction:: BaseClient#declareType(alias, uri, schema)
  :short-name:

  Example:

  .. code:: javascript

     client.declareType('todo-item', {
       "type": "object",
       "properties": {
         "id": {
           "type": "string"
         },
         "title": {
           "type": "string"
         },
         "finished": {
           "type": "boolean"
           "default": false
         },
         "createdAt": {
           "type": "date"
         }
       },
       "required": ["id", "title"]
     })

  Visit `<http://json-schema.org>`_ for details on how
  to use JSON Schema.

.. autofunction:: BaseClient#validate(object)
  :short-name:


  Example:

  .. code:: javascript

    var result = client.validate(document);

    // result:
    // {
    //   error: null,
    //   missing: [],
    //   valid: true
    // }


Caching
-------

.. autofunction:: BaseClient#cache(path, strategy)
  :short-name:

  Example:

  .. code:: javascript

    client.cache('documents/', 'ALL');

.. autofunction:: BaseClient#flush(path)
  :short-name:

  Example:

  .. code:: javascript

    client.flush('documents/');

Other functions
---------------

.. autofunction:: BaseClient#getItemURL(path)
  :short-name:

  .. WARNING::
     This method currently only works for remoteStorage
     backends. The issues for implementing it for Dropbox and Google
     Drive can be found at :issue:`1052` and :issue:`1054`.

.. autofunction:: BaseClient#scope(path)
  :short-name:
