define([
  'require',
  'js/unhosted/ajax',
  'js/unhosted/oauth',
  'js/unhosted/webfinger'
], function(require, ajax, oauth, webfinger) {
  function onError(code, msg) {
    alert(msg);
  }
  function getInfo(userAddress, categories, receiverPageAddress, cb) {
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, onError, function(attributes) {
      var storageAddresses = {};
      for(i in categories) {
        storageAddresses[categories[i]] = webfinger.resolveTemplate(attributes.template, categories[i]);
      }
      cb(attributes.api,
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
      require(['couch'], cb);
    } else {//'simple', 'WebDAV'
      require(['dav'], cb);
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
  return {
    getInfo: getInfo,
    createClient: createClient,
    getPublic: function() { alert('not implemented'); }
  };
});
