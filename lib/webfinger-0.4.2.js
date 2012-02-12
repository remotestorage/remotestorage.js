define(['http://unhosted.org/lib/ajax-0.4.2.js'], function(ajax) {

    ///////////////
   // Webfinger //
  ///////////////

  var options, userAddress, userName, host, templateParts;//this is all a bit messy, but there are a lot of callbacks here, so globals help us with that.
  function getAttributes(ua, setOptions, error, cb){
    options = setOptions;
    userAddress = ua;
    var parts = ua.split('@');
    if(parts.length < 2) {
      error('That is not a user address. There is no @-sign in it');
    } else if(parts.length > 2) {
      error('That is not a user address. There is more than one @-sign in it');
    } else {
      if(!(/^[\.0-9A-Za-z]+$/.test(parts[0]))) {
        error('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"');
      } else if(!(/^[\.0-9A-Za-z\-]+$/.test(parts[1]))) {
        error('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"');
      } else {
        userName = parts[0];
        host = parts[1];
        //error('So far so good. Looking up https host-meta for '+host);
        ajax.ajax({
          //url: 'https://'+host+'/.well-known/host-meta',
          url: 'http://'+host+'/.well-known/host-meta',
          success: function(data) {
            afterHostmetaSuccess(data, error, cb);
          },
          error: function(data) {
            afterHttpsHostmetaError(data, error, cb);
          }
        })
      }
    }
  }

  function afterHttpsHostmetaError(data, error, cb) {
    if(options.allowHttpWebfinger) {
      console.log('Https Host-meta error. Trying http.');
      ajax.ajax({
        url: 'http://'+host+'/.well-known/host-meta',
        success: function(data) {
          afterHostmetaSuccess(data, error, cb);
        },
        error: function(data) {
          afterHttpHostmetaError(data, error, cb);
        }
      })
    } else {
       afterHttpHostmetaError(data, error, cb);
    }
  }

  function afterHttpHostmetaError(data, error, cb) {
    if(options.allowSingleOriginWebfinger) {
      console.log('Trying single origin webfinger through proxy');
      ajax.ajax({
        url: 'http://yourremotestorage.net/CouchDB/proxy/'+host+'/.well-known/host-meta',
        success: function(data) {
          afterHostmetaSuccess(data, error, cb);
        },
        error: function(data) {
          afterProxyError(data, error, cb);
        }
      });
    } else {
      afterProxyError(data, error, cb);
    }
  }
    
  function afterProxyError(data, error, cb) {
    if(options.allowFakefinger) {
      console.log('Trying without the dot and couchy');
      ajax.ajax({
        url: 'http://'+host+'/cors/_design/well-known/_show/host-meta',
        success: function(data) {
          afterHostmetaSuccess(data, error, cb);
        },
        error: function(data) {
          afterProxyNoDotError(data, error, cb);
        }
      });
    } else {
      afterProxyNoDotError(data, error, cb);
    }
  }
    
  function afterProxyNoDotError(data, error, cb) {
    if(options.allowFakefinger) {
      console.log('Trying Fakefinger');
      ajax.ajax({
        url: 'http://useraddress.net/fakefinger',
        method: 'POST',
        data: JSON.stringify({
          audience: location.protocol+'//'+location.host,
          userAddress: userAddress
        }),
        success: function(err, data) {
          cb(JSON.parse(data));
        },
        error: function(err, data) {
          afterFakefingerError(data, error, cb);
        }
      });
    } else {
      afterFakefingerError(data, error, cb);
    }
  }
  function afterFakefingerError(data, error, cb) {
    error(5, 'user address "'+userAddress+'" doesn\'t seem to have remoteStorage linked to it');
  }
  function continueWithTemplate(template, error, cb) {
    templateParts = template.split('{uri}');
    if(templateParts.length == 2) {
      ajax.ajax({
        url: templateParts[0]+'acct:'+userAddress+templateParts[1],
        success: function(data) {afterLrddSuccess(data, error, cb);},
        error: function(data){
          console.log('trying single-origin lrdd');
          ajax.ajax({
            url: 'http://yourremotestorage.net/CouchDB/proxy/'+templateParts[0].substring(7)+'acct:'+userAddress+templateParts[1],
            success: function(data) {afterLrddSuccess(data, error, cb);},
            error: function(data){afterLrddNoAcctError(data, error, cb);}
          });
        }
      });
    } else {
      errorStr = 'the template doesn\'t contain "{uri}"';
    }
  }
  function afterHostmetaSuccess(data, error, cb) {
    dataXml = (new DOMParser()).parseFromString(data, 'text/xml');
    if(!dataXml.getElementsByTagName) {
      error('Host-meta is not an XML document, or doesnt have xml mimetype.');
      return;
    }
    var linkTags = dataXml.getElementsByTagName('Link');
    if(linkTags.length == 0) {
      console.log('no Link tags found in host-meta, trying as JSON');
      try{
        continueWithTemplate(JSON.parse(data).links.lrdd[0].template, error, cb);
      } catch(e) {
        error('JSON parsing failed - '+data);
      }
    } else {
      var lrddFound = false;
      var errorStr = 'none of the Link tags have a lrdd rel-attribute';
      for(var linkTagI = 0; linkTagI < linkTags.length; linkTagI++) {
        for(var attrI = 0; attrI < linkTags[linkTagI].attributes.length; attrI++) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='lrdd')) {
            lrddFound = true;
            errorStr = 'the first Link tag with a lrdd rel-attribute has no template-attribute';
            for(var attrJ = 0; attrJ < linkTags[linkTagI].attributes.length; attrJ++) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                continueWithTemplate(attr2.value, error, cb);
                break;
              }
            }
            break;
          }
        }
        if(lrddFound) {
          break;
        }
      }
      if(!lrddFound) {
        error(errorStr);//todo: make this error flow nicer
      }
    }
  }
  function afterLrddNoAcctError() {
    error('the template doesn\'t contain "{uri}"');
  }
  function afterLrddSuccess(data, error, cb) {
    dataXml = (new DOMParser()).parseFromString(data, 'text/xml');
    if(!dataXml.getElementsByTagName) {
      error('Lrdd is not an XML document, or doesnt have xml mimetype.');
      return;
    }
    var linkTags = dataXml.getElementsByTagName('Link');
    if(linkTags.length == 0) {
      console.log('trying to pars lrdd as jrd');
      try {
        cb(JSON.parse(data).links.remoteStorage[0]);
      } catch(e) {
        error('no Link tags found in lrdd');
      }
    } else {
      var linkFound = false;
      var errorStr = 'none of the Link tags have a remoteStorage rel-attribute';
      for(var linkTagI = 0; linkTagI < linkTags.length; linkTagI++) {
        var attributes = {};
        for(var attrI = 0; attrI < linkTags[linkTagI].attributes.length; attrI++) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='remoteStorage')) {
            linkFound = true;
            errorStr = 'the first Link tag with a dav rel-attribute has no template-attribute';
            for(var attrJ = 0; attrJ < linkTags[linkTagI].attributes.length; attrJ++) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                attributes.template = attr2.value;
              }
              if(attr2.name=='auth') {
                attributes.auth = attr2.value;
              }
              if(attr2.name=='api') {
                attributes.api = attr2.value;
              }
            }
            break;
          }
        }
        if(linkFound) {
          cb(attributes);
          break;
        }
      }
      if(!linkFound) {
        error(errorStr);
      }
    }
  }
  function resolveTemplate(template, dataCategory) {
    var parts = template.split('{category}');
    if(parts.length != 2) {
      return 'cannot-resolve-template:'+template;
    }
    return parts[0]+dataCategory+parts[1];
  }
  return {
    getAttributes: getAttributes,
    resolveTemplate: resolveTemplate
  }
});
