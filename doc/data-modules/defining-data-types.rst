Defining data types
===================

Data types can be defined using the ``declareType()`` method. It expects a name
(which you can later use with ``storeObject()``), as well as a `JSON Schema`_
object defining the actual structure and formatting of your data.

Consider this simplified example of an archive bookmark:

.. CODE:: javascript

   var Bookmarks = { name: 'bookmarks', builder: function(privateClient, publicClient) {

     privateClient.declareType('archive-bookmark', {
       "type": "object",
       "properties": {
         "id": {
           "type": "string"
         },
         "title": {
           "type": "string"
         },
         "url": {
           "type": "string",
           "format": "uri"
         },
         "tags": {
           "type": "array",
           "default": []
         },
       },
       "required": [ "title", "url" ]
     });

     // ...
   }};

Now that we have a basic data type in place for storing bookmarks, we can add a
function for storing them. This will actually validate the incoming data
against the type's schema, and reject the promise with detailed validation
errors in case the data format doesn't match::

   var Bookmarks = { name: 'bookmarks', builder: function(privateClient, publicClient) {
     // ...

     return {
       exports: {

         add: function (bookmark) {
           bookmark.id = md5Hash(bookmark.url); // hash URL for nice ID
           var path = "archive/" + bookmark.id; // use hashed URL as filename as well

           return privateClient.storeObject("archive-bookmark", path, bookmark).
             then(function() {
               return bookmark; // return bookmark with added ID property
             });
         }

       }
     }
   }};

   // and in your app:

   remoteStorage.bookmarks.add({
     title: 'Unhosted Web Apps',
     url: 'https://unhosted.org',
     tags: ['unhosted', 'remotestorage', 'offline-first']
   })
   .then(() => {
     console.log('stored bookmark successfully');
   })
   .catch((err) => {
     console.error('validation error:', err);
   });

.. HINT::
   JSON Schema is very powerful and flexible. If you want to learn more about
   it, check out the free e-book `Understanding JSON
   Schema <https://spacetelescope.github.io/understanding-json-schema/>`_ for
   example. The complete official specs can be found at
   http://json-schema.org/documentation.html

.. _JSON Schema: http://json-schema.org
