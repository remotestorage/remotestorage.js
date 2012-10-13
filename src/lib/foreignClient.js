define(['./util', './baseClient', './getputdelete', './store'], function(util, BaseClient, getputdelete, store) {

  var logger = util.getLogger('foreignClient');

  var ForeignClient = function(userAddress, storageInfo) {
    this.storageInfo = storageInfo;
    this.userAddress = userAddress;
    this.pathPrefix = userAddress + ':'

    BaseClient.apply(this, ['root', true]);
  }
  
  ForeignClient.prototype = {

    getPublished: function(moduleName, callback) {
      this.getObject('/' + moduleName + '/publishedItems', function(err, data) {
        if(data) { delete data['@type'] }
        callback(err, data || {});
      });
    },

    getPublishedObjects: function(moduleName, callback) {
      this.getPublished(moduleName, function(err, list) {
        if(err) {
          callback(err);
        } else {
          var paths = Object.keys(list);
          var i=0;
          var objects = {};
          var errors = [];
          function loadOne() {
            if(i < paths.length) {
              var path = '/' + moduleName + '/' + paths[i++];
              this.getObject(path, function(e, object) {
                if(e) {
                  errors.push(e);
                } else {
                  objects[path] = object;
                }

                loadOne.call(this);
              }.bind(this));
            } else {
              callback(errors.length > 0 ? err : null, objects);
            }
          }

          loadOne.call(this);
        }
      }.bind(this));
    },

    makePath: function(path) {
      return this.pathPrefix + BaseClient.prototype.makePath.call(this, path);
    },

    nodeGivesAccess: function(path, mode) {
      return mode == 'r';
    },

    fetchNow: function(path, callback) {
      getputdelete.get(this.buildUrl(path), null, function(err, data, mimeType) {
        if(data) {
          var now = new Date().getTime();
          store.setNodeData(path, data, false, now, mimeType);
        }
        callback(err, data);
      });
    },

    buildUrl: function(path) {
      return this.storageInfo.href + '/public' + path.split(':')[1];
    }

  }

  var methodBlacklist = {
    makePath: true,
    getListing: true,
    getAll: true,
    storeDocument: true,
    storeObject: true,
    remove: true,
    nodeGivesAccess: true,
    fetchNow: true,
    syncNow: true
  }

  // inherit some stuff from BaseClient

  for(var key in BaseClient.prototype) {
    if(! methodBlacklist[key]) {
      ForeignClient.prototype[key] = BaseClient.prototype[key];
    }
  }

  return ForeignClient;

});