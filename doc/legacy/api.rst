Module API
==========

.. ATTENTION::
   This document has not yet been updated for rs.js 1.0.0+. It likely contains
   outdated information and API calls.

Defining modules
----------------

Start by defining a module (check out the repo to reuse an existing
one):

.. code:: javascript

   remoteStorage.defineModule('name', function(privClient, pubCient) {
     //basics:
     privClient.cache(path, strategy); //*** new behavior in 0.10 ***//
     privClient.on('change', function((evt) {}); //*** new behavior in 0.10 ***//
     return {
       exports: {
         storeData: function() {
           privClient.storeObject(ldType, path, obj);
           privClient.storeFile(mimeType, path, arrBuffOrStr);
           privClient.remove(path);
         },
         getData: function() {
           privClient.getListing(path, maxAge).then(function(itemsMap) { //*** new parameter maxAge in 0.10 ***//
             //itemsMap === { 'a/': {ETag: '123'}}
           });
           privClient.getObject(path, maxAge).then(function(obj) { //*** new parameter maxAge in 0.10 ***//
             //obj == { '@context': '...', firstName: '...' }
           });
           privClient.getFile(path, maxAge).then(function(obj) { //*** new parameter maxAge in 0.10 ***//
             //obj = { data: arrBuffOrStr, mimeType: 'application/json'}
           });
           var url = pubClient.getItemURL(path)
         },
         advanced: function() {
           privClient.scope('prefix/')
           privClient.getAll('path/')
         }
       }
     };
   });

Configuring caching
-------------------

This example shows how to configure caching in a module:

.. code:: javascript

   var beersBuilder = function (privateClient, publicClient) {
     var pilsener = privateClient.scope('pilsener/');

     // To enable always caching all data (not only data that was changed),
     // change the caching strategy from 'SEEN' (the default) to 'ALL'.
     // These two are equivalent operations:
     privateClient.cache('pilsener/', 'ALL');
     // OR:
     pilsener.cache('', 'ALL');

     // To disable caching for a given path, pass 'FLUSH' as the strategy:
     privateClient.cache('pilsener/', 'FLUSH');
     // OR:
     pilsener.cache('', 'FLUSH');

     return {
       exports: {
         pilsener: pilsener
       }
     };
   };

   export default { name: 'beers', builder: beersBuilder };

Using a module in your app
--------------------------

.. code:: js

   remoteStorage.displayWidget();
   remoteStorage.access.claim('name', 'rw');
   remoteStorage.name.func1()...
   remoteStorage[name].func1()...

Customization
-------------

.. code:: js

   RemoteStorage.config.changeEvents = {
     local: false, // for better page load performance
     window: false, // for better write performance
     remote: true,
     conflict: true
   };
   RemoteStorage.config.logging = false;
   remoteStorage.on('ready', ...)
   remoteStorage.setApiKeys(backend, keys);
   remoteStorage.connect('user@host'[, backend]); // triggers WebFinger+OAuth
   remoteStorage.remote.configure({token: 'foo'}); // directly, no OAuth
   remoteStorage.disconnect();
   remoteStorage.connected
