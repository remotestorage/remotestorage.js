define([
  'require',
  './ajax',
  './webfinger'
], function(require, ajax, webfinger) {
  function getPublicBackend(userAddress, err, cb) {
    webfinger.getAttributes(userAddress, {
      allowHttpWebfinger: true,
      allowSingleOriginWebfinger: false,
      allowFakefinger: true
    }, err, function(attributes) {
      if(attributes.api == 'CouchDB') {
        var publicCategoryUrl = webfinger.resolveTemplate(attributes.template, 'public');
        cb({
          get: function(key, err, cb) {
            ajax.ajax({
              url: publicCategoryUrl+key,
              error: err,
              success: function(data) {
                try {
                  var obj = JSON.parse(data);
                  cb(obj.value);
                } catch(e) {
                  err(e);
                }
              }
            });
          }
        });
      } else {
        err('dont know api '+attributes.api);
      }
    });
  }
  function receive (senderAddress, hash, cb) {
    getPublicBackend(senderAddress, function() { cb('no good backend'); }, function(backend) {
      backend.get(hash, function() {
        cb('something went wrong');
      }, function(value) {
        cb(value);
      }, NaN);
    });
  }
  return {
    receive: receive
  };
});
