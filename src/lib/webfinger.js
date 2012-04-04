define(
  ['./platform'],
  function (platform) {

      ///////////////
     // Webfinger //
    ///////////////

    function userAddress2hostMetas(userAddress, cb) {
      var parts = userAddress.split('@');
      if(parts.length < 2) {
        cb('That is not a user address. There is no @-sign in it');
      } else if(parts.length > 2) {
        cb('That is not a user address. There is more than one @-sign in it');
      } else {
        if(!(/^[\.0-9A-Za-z]+$/.test(parts[0]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
        } else if(!(/^[\.0-9A-Za-z\-]+$/.test(parts[1]))) {
          cb('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
        } else {
          cb(null, [
            //'https://'+parts[1]+'/.well-known/host-meta.json',
            'https://'+parts[1]+'/.well-known/host-meta',
            //'http://'+parts[1]+'/.well-known/host-meta.json',
            'http://'+parts[1]+'/.well-known/host-meta'
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
      for(var rel in obj.links) {
        //just take the first one of each rel:
        if(obj.links[rel].length >= 1) {
          links[rel]=obj.links[rel][0];
        }
      }
      cb(null, links);
    }
    function getStorageInfo(userAddress, options, cb) {
      userAddress2hostMetas(userAddress, function(err1, hostMetaAddresses) {
        if(err1) {
          cb(err);
        } else {
          fetchXrd(hostMetaAddresses, options.timeout, function(err2, hostMetaLinks) {
            if(err2) {
              cb('could not fetch host-meta for '+userAddress);
            } else {
              if(hostMetaLinks['lrdd'] && hostMetaLinks['lrdd'].template) {
                var parts = hostMetaLinks['lrdd'].template.split('{uri}');
                var lrddAddresses=[parts.join('acct:'+userAddress), parts.join(userAddress)];
                 fetchXrd(lrddAddresses, options.timeout, function(err4, lrddLinks) {
                  if(err4) {
                    cb('could not fetch lrdd for '+userAddress);
                  } else {
                     //FROM:
                    //{
                    //  api: 'WebDAV',
                    //  template: 'http://host/foo/{category}/bar',
                    //  auth: 'http://host/auth'
                    //}
                    //TO:
                    //{
                    //  type: 'pds-remotestorage-00#webdav',
                    //  href: 'http://host/foo/',
                    //  legacySuffix: '/bar'
                    //  auth: {
                    //    type: 'pds-oauth2-00',
                    //    href: 'http://host/auth'
                    //  }
                    //}
                    if(lrddLinks['remoteStorage'] && lrddLinks['remoteStorage']['auth'] && lrddLinks['remoteStorage']['api'] && lrddLinks['remoteStorage']['template']) {
                      var storageInfo = {};
                      if(lrddLinks['remoteStorage']['api'] == 'simple') {
                        storageInfo['type'] = 'pds-remotestorage-00#simple';
                      } else if(lrddLinks['remoteStorage']['api'] == 'WebDAV') {
                        storageInfo['type'] = 'pds-remotestorage-00#webdav';
                      } else if(lrddLinks['remoteStorage']['api'] == 'CouchDB') {
                        storageInfo['type'] = 'pds-remotestorage-00#couchdb';
                      } else {
                        cb('api not recognized');
                        return;
                      }

                      var templateParts = lrddLinks['remoteStorage']['template'].split('{category}');
                      if(templateParts[0].substring(templateParts[0].length-1)=='/') {
                        storageInfo['href'] = templateParts[0].substring(0, templateParts[0].length-1);
                      } else {
                        storageInfo['href'] = templateParts[0];
                      }
                      if(templateParts.length == 2 && templateParts[1] != '/') {
                        storageInfo['legacySuffix'] = templateParts[1];
                      }
                      storageInfo['auth'] = {
                        type: 'pds-oauth2-00',
                        href: lrddLinks['remoteStorage']['auth']
                      };
                      cb(null, storageInfo);
                    } else if(lrddLinks['remotestorage']
                        && lrddLinks['remotestorage']['href']
                        && lrddLinks['remotestorage']['type']
                        && lrddLinks['remotestorage']['links']
                        && lrddLinks['remotestorage']['links']['auth']
                        && lrddLinks['remotestorage']['links']['auth'][0]//although parseAsJrd takes out the first link of each rel, it leaves nested links in a list
                        && lrddLinks['remotestorage']['links']['auth'][0]['href']
                        && lrddLinks['remotestorage']['links']['auth'][0]['type']
                        && lrddLinks['remotestorage']['links']['auth'][0]['type'] == 'oauth2-ig'
                        ) {
                      lrddLinks['remotestorage']['auth']= lrddLinks['remotestorage']['links']['auth'][0];
                      delete lrddLinks['remotestorage']['links'];
                      cb(null, lrddLinks['remotestorage']);
                    } else {
                      cb('could not extract storageInfo from lrdd');
                    }
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
