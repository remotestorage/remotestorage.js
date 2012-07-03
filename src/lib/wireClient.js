//the session holds the storage info, so when logged in, you go:
//application                                application
//    module                             module
//        baseClient                 baseClient
//            cache              cache
//                session    session
//                    wireClient
//
//and if you're not logged in it's simply:
//
//application                application
//      module              module
//        baseClient  baseClient
//                cache 

define(['./platform', './couch', './dav', './getputdelete', './session'], function (platform, couch, dav, getputdelete, session) {
  function getDriver(type, cb) {
    if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#couchdb'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb') {
      cb(couch);
    } else if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#webdav'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav') {
      cb(dav);
    } else {
      cb(getputdelete);
    }
  }
  function resolveKey(storageInfo, basePath, relPath, nodirs) {
    var itemPathParts = ((basePath.length?(basePath + '/'):'') + relPath).split('/');
    var item = itemPathParts.splice(2).join(nodirs ? '_' : '/');
    return storageInfo.href + '/' + itemPathParts[1]
      + (storageInfo.properties.legacySuffix ? storageInfo.properties.legacySuffix : '')
      + '/' + (item[2] == '_' ? 'u' : '') + item;
  }
  return {
    get: function (path, cb) {
      var storageInfo = session.getStorageInfo(),
        token = session.getBearerToken();
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else {
        getDriver(storageInfo.type, function (d) {
          d.get(resolveKey(storageInfo, '', path, storageInfo.nodirs), token, cb);
        });
      }
    },
    set: function (path, valueStr, cb) {
      var storageInfo = session.getStorageInfo(),
        token = session.getBearerToken();
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else if(typeof(valueStr) != 'string') {
        cb('argument "valueStr" should be a string');
      } else {
        getDriver(storageInfo.type, function (d) {
          d.set(resolveKey(storageInfo, '', path, storageInfo.nodirs), value, token, cb);
        });
      }
    }
  };
});
