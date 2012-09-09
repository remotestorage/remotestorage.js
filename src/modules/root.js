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
    }
  });

  remoteStorage.defineModule('root', function(myPrivateBaseClient, myPublicBaseClient) {
    function setOnChange(cb) {
      myPrivateBaseClient.on('change', function(e) {
        console.log(e); cb(e);
      });
      myPublicBaseClient.on('change', function(e) {
        console.log(e); cb(e);
      });
    }

    function addToPublicItems(path) {
      var data = myPublicBaseClient.getObject("publishedItems");
      if(path[0] == "/")
        path = path.substr(1);

      if(data) {
        if(data.indexOf(path) == -1)
        {
          data.unshift(path);
        }
      } else {
        data = [];
        data.push(path);
      }
      myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function removeFromPublicItems(path) {
      var data = myPublicBaseClient.getObject("publishedItems");
      if(path[0] == "/")
        path = path.substr(1);
      if(data) {
        if(data.indexOf(path) != -1) {
          data.pop(path);
        }
      } else {
        data = [];
      }
      myPublicBaseClient.storeObject('array', "publishedItems", data);
    }

    function publishObject(path) {
      if(pathIsPublic(path))
        return 'Object has already been made public';

      var data = myPrivateBaseClient.getObject(path);
      var publicPath = "/public" + path;
      addToPublicItems(publicPath);
      myPrivateBaseClient.remove(path);
      myPrivateBaseClient.storeObject(data['@type'], publicPath, data);

      return "Object " + path + " has been published to " + publicPath;
    }

    function archiveObject(path) {
      if(!pathIsPublic(path))
        return 'Object has already been made private';

      var data = myPrivateBaseClient.getObject(path);
      var privatePath = path.substring(7, path.length);
      removeFromPublicItems(path);
      myPrivateBaseClient.remove(path);
      myPrivateBaseClient.storeObject(data['@type'], privatePath, data);

      return "Object " + path + " has been archived to " + privatePath;
    }

    function pathIsPublic(path) {
      if(path.substring(0, 8) == "/public/")
        return true;
      return false;
    }

    function getClient(path) {
      if(!pathIsPublic(path))
        return myPrivateBaseClient;
      return myPublicBaseClient;
    }

    /** getObject(path, [callback, [context]]) - get the object at given path
     **
     ** If the callback is NOT given, getObject returns the object at the given
     ** path from local cache:
     **
     **   remoteStorage.root.getObject('/todo/today')
     **   // -> { items: ['sit in the sun', 'watch the clouds', ...], ... }
     **
     ** If the callback IS given, getObject returns undefined and will at some
     ** point in the future, when the object's data has been pulled, call
     ** call the given callback.
     **
     **   remoteStorage.root.getObject('/todo/tomorrow', function(list) {
     **     // do something
     **   });
     ** 
     ** If both callback and context are given, the callback will be bound to
     ** the given context object:
     **
     **  remoteStorage.root.getObject('/todo/next-months', function(list) {
     **      for(var i=0;i<list.items.length;i++) {
     **        this.addToBacklog(list.items[i]);
     **      }// ^^ context 
     **    },
     **    this // < context.
     **  );
     **
     **/
    function getObject(path, cb, context) {
      var client = getClient(path);
      return client.getObject(path, cb, context);
    }

    /** setObject(type, path, object) - store the given object at the given path.
     **
     ** The given type should be a string and is used to build a JSON-LD @type
     ** URI to store along with the given object.
     **
     **/
    function setObject(type, path, obj) {
      var client = getClient(path);
      client.storeObject(type, path, obj);
    }

    /** removeObject(path) - remove node at given path
     **/
    function removeObject(path) {
      var client = getClient(path);
      client.remove(path);
    }

    /** getListing(path, [callback, [context]]) - get a listing of the given
     **                                           path's child nodes.
     **
     ** Callback and return semantics are the same as for getObject.
     **/
    function getListing(path, cb, context) {
      var client = getClient(path);
      return client.getListing(path, cb, context);
    }

    return {
      exports: {
        getListing: getListing,
        getObject: getObject,
        setObject: setObject,
        removeObject: removeObject,
        archiveObject: archiveObject,
        publishObject: publishObject,
        setOnChange:setOnChange
      }
    }
  });

  return remoteStorage.root;

});
