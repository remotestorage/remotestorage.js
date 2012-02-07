define([
  'require',
  '0.2.0/ajax',
  '0.2.0/oauth',
  '0.2.0/webfinger'
], function(require, ajax, oauth, webfinger) {
  function onError(code, msg) {
    alert(msg);
  }
  function getInfo(userAddress, categories, receiverPageAddress, cb) {
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, function(err, data) {
      cb(err, null, null, []);
    }, function(attributes) {
      var storageAddresses = {};
      for(i in categories) {
        storageAddresses[categories[i]] = webfinger.resolveTemplate(attributes.template, categories[i]);
      }
      cb(0, attributes.api,
        attributes.auth
          +'?redirect_uri='+encodeURIComponent(receiverPageAddress)
          +'&scope'+encodeURIComponent(categories.join(','))
          +'&response_type=token'
          +'&client_id='+encodeURIComponent(receiverPageAddress),
        storageAddresses);
    });
  }
  function getDriver(api, cb) {
    if(api == 'CouchDB') {
      require(['0.2.0/couch'], cb);
    } else {//'simple', 'WebDAV'
      require(['0.2.0/dav'], cb);
    }
  }
  function createClient(storageAddress, api, token) {
    return {
      get: function(key, cb) {
       getDriver(api, function(d) {
         d.get(storageAddress, token, key, cb);
       });
      },
      put: function(key, value, cb) {
       getDriver(api, function(d) {
         d.put(storageAddress, token, key, value, cb);
       });
      },
      delete: function(key, cb) {
       getDriver(api, function(d) {
         d.delete(storageAddress, token, key, cb);
       });
      }
    };
  }
  function getPublic(userAddress, key, cb) {
    getInfo(userAddress, ['public'], '', function(err, api, auth, addresses) {
      var client = createClient(addresses[0], api, null);
      client.get(key, cb);
    });
  }
  return {
    getInfo: getInfo,
    createClient: createClient,
    getPublic: getPublic
  };
});
