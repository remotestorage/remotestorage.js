define(['../remoteStorage'], function(remoteStorage) {

  remoteStorage.defineModule('public', function(client) {
    function getPublicItems() {
      return client.getObject("publishedItems");
    }

    return {
      exports: {
        getPublicItems: getPublicItems,
        getObject: client.getObject
      }
    };
  });

  remoteStorage.defineModule('root', function(myPrivateBaseClient, myPublicBaseClient) {
    // function setOnChange(cb) {
    //   myPrivateBaseClient.on('change', cb);
    //   myPublicBaseClient.on('change', cb);
    // }

    // function addToPublicItems(path) {
    //   var data = myPublicBaseClient.getObject("publishedItems");
    //   if(path[0] == "/")
    //     path = path.substr(1);

    //   if(data) {
    //     if(data.indexOf(path) == -1)
    //     {
    //       data.unshift(path);
    //     }
    //   } else {
    //     data = [];
    //     data.push(path);
    //   }
    //   myPublicBaseClient.storeObject('array', "publishedItems", data);
    // }

    // function removeFromPublicItems(path) {
    //   var data = myPublicBaseClient.getObject("publishedItems");
    //   if(path[0] == "/")
    //     path = path.substr(1);
    //   if(data) {
    //     if(data.indexOf(path) != -1) {
    //       data.pop(path);
    //     }
    //   } else {
    //     data = [];
    //   }
    //   myPublicBaseClient.storeObject('array', "publishedItems", data);
    // }

    // function publishObject(path) {
    //   if(pathIsPublic(path))
    //     return 'Object has already been made public';

    //   var data = myPrivateBaseClient.getObject(path);
    //   var publicPath = "/public" + path;
    //   addToPublicItems(publicPath);
    //   myPrivateBaseClient.remove(path);
    //   myPrivateBaseClient.storeObject(data['@type'], publicPath, data);

    //   return "Object " + path + " has been published to " + publicPath;
    // }

    // function archiveObject(path) {
    //   if(!pathIsPublic(path))
    //     return 'Object has already been made private';

    //   var data = myPrivateBaseClient.getObject(path);
    //   var privatePath = path.substring(7, path.length);
    //   removeFromPublicItems(path);
    //   myPrivateBaseClient.remove(path);
    //   myPrivateBaseClient.storeObject(data['@type'], privatePath, data);

    //   return "Object " + path + " has been archived to " + privatePath;
    // }

    // function pathIsPublic(path) {
    //   if(path.substring(0, 8) == "/public/")
    //     return true;
    //   return false;
    // }

    // function getClient(path) {
    //   if(!pathIsPublic(path))
    //     return myPrivateBaseClient;
    //   return myPublicBaseClient;
    // }

    // function hasDiff(path) {
    //   var client = getClient(path);
    //   return client.hasDiff(path);
    // }

    // /** getObject(path, [callback, [context]]) - get the object at given path
    //  **
    //  ** If the callback is NOT given, getObject returns the object at the given
    //  ** path from local cache:
    //  **
    //  **   remoteStorage.root.getObject('/todo/today')
    //  **   // -> { items: ['sit in the sun', 'watch the clouds', ...], ... }
    //  **
    //  ** If the callback IS given, getObject returns undefined and will at some
    //  ** point in the future, when the object's data has been pulled, call
    //  ** call the given callback.
    //  **
    //  **   remoteStorage.root.getObject('/todo/tomorrow', function(list) {
    //  **     // do something
    //  **   });
    //  ** 
    //  ** If both callback and context are given, the callback will be bound to
    //  ** the given context object:
    //  **
    //  **  remoteStorage.root.getObject('/todo/next-months', function(list) {
    //  **      for(var i=0;i<list.items.length;i++) {
    //  **        this.addToBacklog(list.items[i]);
    //  **      }// ^^ context 
    //  **    },
    //  **    this // < context.
    //  **  );
    //  **
    //  **/
    // function getObject(path, cb, context) {
    //   return myPrivateBaseClient.getObject(path, cb, context);
    // }

    // function getDocument(path, cb, context) {
    //   return myPrivateBaseClient.getDocument(path, cb, context);
    // }

    // function setDocument(mimeType, path, data, cb, context) {
    //   return myPrivateBaseClient.storeDocument(mimeType, path, data, cb, context);
    // }

    // /** setObject(type, path, object) - store the given object at the given path.
    //  **
    //  ** The given type should be a string and is used to build a JSON-LD @type
    //  ** URI to store along with the given object.
    //  **
    //  **/
    // function setObject(type, path, obj) {
    //   if(typeof(obj) === 'object') {
    //     myPrivateBaseClient.storeObject(type, path, obj);
    //   } else {
    //     myPrivateBaseClient.storeDocument(type, path, obj);
    //   }
    // }

    // /** removeObject(path) - remove node at given path
    //  **/
    // function removeObject(path) {
    //   myPrivateBaseClient.remove(path);
    // }

    // /** getListing(path, [callback, [context]]) - get a listing of the given
    //  **                                           path's child nodes.
    //  **
    //  ** Callback and return semantics are the same as for getObject.
    //  **/
    // function getListing(path, cb, context) {
    //   if(! path) {
    //     throw "Path is required"
    //   }
    //   return myPrivateBaseClient.getListing(path, cb, context);
    // }

    // function on(eventName, callback) {
    //   myPrivateBaseClient.on(eventName, callback);
    //   myPublicBaseClient.on(eventName, callback);
    // }

    // return {
    //   exports: {
    //     on: on,
    //     use: function() {
    //       myPrivateBaseClient.use.apply(myPrivateBaseClient, arguments);
    //     },
    //     release: function() {
    //       myPrivateBaseClient.release.apply(myPrivateBaseClient, arguments);
    //     },
    //     getListing: getListing,
    //     getObject: getObject,
    //     setObject: setObject,
    //     getDocument: getDocument,
    //     setDocument: setDocument,
    //     removeObject: removeObject,
    //     archiveObject: archiveObject,
    //     publishObject: publishObject,
    //     setOnChange: setOnChange,
    //     hasDiff: hasDiff,
    //     syncOnce: myPrivateBaseClient.syncOnce.bind(myPrivateBaseClient)
    //   }
    // }

    return { exports: myPrivateBaseClient };
  });

  return remoteStorage.root;

});
