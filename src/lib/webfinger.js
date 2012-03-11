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
            'https://'+parts[1]+'/.well-known/host-meta.json',
            'https://'+parts[1]+'/.well-known/host-meta',
            'http://'+parts[1]+'/.well-known/host-meta.json',
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
            cb(null, data);
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
    function getElements(dataXml, tagName) {
      var elts=[];
      var nodes = dataXml.getElementsByTagName(tagName);
      for(var i=0; i < nodes.length; i++) {
        var elt={};
        for(var j=0; j<nodes[i].attributes.length; j++) {
          var attr = nodes[i].attributes[j];
          elt[attr.name]=attr.value;
        }
        elts.push(elt);
      }
      return elts;
    }
    function parseProperties(properties) {
      return [];
    }
    function xrd2jrd(xrd) {
      dataXml = platform.parseXml(xrd);
      if(!dataXml.getElementsByTagName) {
        try {
          return JSON.parse(xrd);
        } catch(e) {
          return xrd;
        }
      }
      return {
        subject: getElements(dataXml, 'Subject')[0],
        expires: getElements(dataXml, 'Expires')[0],
        aliases:getElements(dataXml, 'aliases'),
        properties:parseProperties(getElements(dataXml, 'Property')),
        links:getElements(dataXml, 'Link')
      };
    }
    function parseXrd(xrd, cb) {
      var jrd = xrd2jrd(xrd);
      var obj = {};
      if(jrd && jrd.links) {
        for(var i=0; i<jrd.links.length;i++) {
          obj[jrd.links[i].rel]=jrd.links[i];
        }
      }
      return obj;
    }
    function getStorageInfo(userAddress, options, cb){
      userAddress2hostMetas(userAddress, function(err1, hostMetaAddresses) {
        if(err1) {
          cb(err);
        } else {
          fetchXrd(hostMetaAddresses, options.timeout, function(err2, hostMeta) {
            if(err2) {
              cb('could not fetch host-meta for '+userAddress);
            } else {
              var links = parseXrd(hostMeta);
              if(links['lrdd'] && links['lrdd'].template) {
                var parts = links['lrdd'].template.split('{uri}');
                var lrddAddresses=[parts.join('acct:'+userAddress), parts.join(userAddress)];
                fetchXrd(lrddAddresses, options.timeout, function(err4, lrdd) {
                  if(err4) {
                    cb('could not fetch lrdd for '+userAddress);
                  } else {
                    var links = parseXrd(lrdd);
                    if(links['remoteStorage']) {
                      cb(null, links['remoteStorage']);
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
    function resolveTemplate(template, dataCategory) {
      var parts = template.split('{category}');
      if(parts.length != 2) {
        return 'cannot-resolve-template:'+template;
      }
      return parts[0]+dataCategory+parts[1];
    }
    return {
      getStorageInfo: getStorageInfo,
      resolveTemplate: resolveTemplate
    }
});
