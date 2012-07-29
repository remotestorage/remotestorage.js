define(
  ['./platform'],
  function (platform) {

      ///////////////
     // Webfinger //
    ///////////////

    function userAddress2hostMetas(userAddress, cb) {
      var parts = userAddress.toLowerCase().split('@');
      if(parts.length < 2) {
        cb('That is not a user address. There is no @-sign in it');
      } else if(parts.length > 2) {
        cb('That is not a user address. There is more than one @-sign in it');
      } else {
        if(!(/^[\.0-9a-z\-\_]+$/.test(parts[0]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
        } else if(!(/^[\.0-9a-z\-]+$/.test(parts[1]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
        } else {
          var query = '?resource=acct:'+encodeURIComponent(userAddress);
          cb(null, [
            'https://'+parts[1]+'/.well-known/host-meta.json'+query,
            'https://'+parts[1]+'/.well-known/host-meta'+query,
            'http://'+parts[1]+'/.well-known/host-meta.json'+query,
            'http://'+parts[1]+'/.well-known/host-meta'+query
            ]);
        }
      }
    }
    function fetchXrd(addresses, timeout, cb) {
      var firstAddress = addresses.shift();
      if(firstAddress) {
        platform.ajax({
          url: firstAddress,
          success: function(data) {
            parseAsJrd(data, function(err, obj){
              if(err) {
                parseAsXrd(data, function(err, obj){
                  if(err) {
                    fetchXrd(addresses, timeout, cb);
                  } else {
                    cb(null, obj);
                  }
                });
              } else {
                cb(null, obj);
              }
            });
          },
          error: function(data) {
            fetchXrd(addresses, timeout, cb);
          },
          timeout: timeout
        });
      } else {
        cb('could not fetch xrd');
      }
    }
    function parseAsXrd(str, cb) {
      platform.parseXml(str, function(err, obj) {
        if(err) {
          cb(err);
        } else {
          if(obj && obj.Link) {
            var links = {};
            if(obj.Link && obj.Link['@']) {//obj.Link is one element
              if(obj.Link['@'].rel) {
                links[obj.Link['@'].rel]=obj.Link['@'];
              }
            } else {//obj.Link is an array
              for(var i=0; i<obj.Link.length; i++) {
                if(obj.Link[i]['@'] && obj.Link[i]['@'].rel) {
                  links[obj.Link[i]['@'].rel]=obj.Link[i]['@'];
                }
              }
            }
            cb(null, links);
          } else {
            cb('found valid xml but with no Link elements in there');
          }
        }
      });
    }
    function parseAsJrd(str, cb) {
      var obj;
      try {
        obj = JSON.parse(str);
      } catch(e) {
        cb('not valid JSON');
        return;
      }
      var links = {};
      for(var i=0; i<obj.links.length; i++) {
        //just take the first one of each rel:
        if(obj.links[i].rel) {
          links[obj.links[i].rel]=obj.links[i];
        }
      }
      cb(null, links);
    }

    var rww = 'http://www.w3.org/community/rww/wiki/Read-write-web-00#';
    var legacyApiTypes = {
      'simple': rww + 'simple',
      'WebDAV': rww + 'webdav',
      'CouchDB': rww + 'couchdb'
    }

    function parseRemoteStorageLink(obj, cb) {
      //FROM:
      //{
      //  api: 'WebDAV',
      //  template: 'http://host/foo/{category}/bar',
      //  auth: 'http://host/auth'
      //}
      //TO:
      //{
      //  type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav',
      //  href: 'http://host/foo/',
      //  legacySuffix: '/bar'
      //  properties: {
      //    'access-methods': ['http://oauth.net/core/1.0/parameters/auth-header'],
      //    'auth-methods': ['http://oauth.net/discovery/1.0/consumer-identity/static'],
      //    'auth-endpoint': 'http://host/auth'
      //  }
      //}
      if(obj && obj['auth'] && obj['api'] && obj['template']) {
        var storageInfo = {};

        storageInfo['type'] = legacyApiTypes[ obj['api'] ];

        if(! storageInfo['type']) {
          cb('api not recognized: ', + obj['api']);
          return;
        }

        var templateParts = obj['template'].split('{category}');
        if(templateParts[0].substring(templateParts[0].length-1)=='/') {
          storageInfo['href'] = templateParts[0].substring(0, templateParts[0].length-1);
        } else {
          storageInfo['href'] = templateParts[0];
        }
        storageInfo.properties = {
          "access-methods": ["http://oauth.net/core/1.0/parameters/auth-header"],
          "auth-methods": ["http://oauth.net/discovery/1.0/consumer-identity/static"],
          "auth-endpoint": obj['auth']
        };
        if(templateParts.length == 2 && templateParts[1] != '/') {
          storageInfo.properties['legacySuffix'] = templateParts[1];
        }
        cb(null, storageInfo);
      } else if(obj
          && obj['href']
          && obj['type']
          && obj['properties']
          && obj['properties']['auth-endpoint']
          ) {
        cb(null, obj);
      } else {
        cb('could not extract storageInfo from lrdd');
      }
    }
    function getStorageInfo(userAddress, options, cb) {
      userAddress2hostMetas(userAddress, function(err1, hostMetaAddresses) {
        if(err1) {
          cb(err1);
        } else {
          fetchXrd(hostMetaAddresses, options.timeout, function(err2, hostMetaLinks) {
            if(err2) {
              cb('could not fetch host-meta for '+userAddress);
            } else {
              if(hostMetaLinks['remoteStorage']) {
                parseRemoteStorageLink(hostMetaLinks['remoteStorage'], cb);
              } else if(hostMetaLinks['remotestorage']) {
                parseRemoteStorageLink(hostMetaLinks['remoteStorage'], cb);
              } else if(hostMetaLinks['lrdd'] && hostMetaLinks['lrdd'].template) {
                var parts = hostMetaLinks['lrdd'].template.split('{uri}');
                var lrddAddresses=[parts.join('acct:'+userAddress), parts.join(userAddress)];
                 fetchXrd(lrddAddresses, options.timeout, function(err4, lrddLinks) {
                  if(err4) {
                    cb('could not fetch lrdd for '+userAddress);
                  } else if(lrddLinks['remoteStorage']) {
                    parseRemoteStorageLink(lrddLinks['remoteStorage'], cb);
                  } else if(lrddLinks['remotestorage']) {
                    parseRemoteStorageLink(lrddLinks['remotestorage'], cb);
                  } else {
                    cb('could not extract storageInfo from lrdd');
                  }
                }); 
              } else {
                cb('could not extract lrdd template from host-meta');
              }
            }
          });
        }
      });
    }
    return {
      getStorageInfo: getStorageInfo
    }
});
