define(function(require, exports, module) {

    ///////////////
   // Webfinger //
  ///////////////

  exports.webfinger = (function(){
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
          exports.ajax({
            //url: 'https://'+host+'/.well-known/host-meta',
            url: 'http://'+host+'/.well-known/host-meta',
            success: function(data) {
              afterHostmetaSuccess(data, error, cb);
            },
            error: function(data) {
              afterHttpsHostmetaError(data, error, cb);
            },
          })
        }
      }
    }

    function afterHttpsHostmetaError(data, error, cb) {
      if(options.allowHttpWebfinger) {
        console.log('Https Host-meta error. Trying http.');
        exports.ajax({
          url: 'http://'+host+'/.well-known/host-meta',
          success: function(data) {
            afterHostmetaSuccess(data, error, cb);
          },
          error: function(data) {
            afterHttpHostmetaError(data, error, cb);
          },
        })
      } else {
         afterHttpHostmetaError(data, error, cb);
      }
    }

    function afterHttpHostmetaError(data, error, cb) {
      if(options.allowSingleOriginWebfinger) {
        console.log('Trying single origin webfinger through proxy');
        exports.ajax({
          url: 'http://useraddress.net/single-origin-webfinger...really?'+userAddress,
          success: function(data) {
            afterLrddSuccess(data, error, cb);
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
        console.log('Trying Fakefinger');
        exports.ajax({
          url: 'http://useraddress.net/fakefinger?userAddress='+userAddress,
          success: function(data) {
            afterLrddSuccess(data, error, cb);
          },
          error: function(data) {
            afterFakefingerError(data, error, cb);
          }
        });
      } else {
        afterFakefingerError(data, error, cb);
      }
    }
    function afterFakefingerError() {
      alert('user address "'+userAddress+'" doesn\'t seem to have remoteStorage linked to it');
    }
    function afterHostmetaSuccess(data, error, cb) {
      data = (new DOMParser()).parseFromString(data, 'text/xml');
      if(!data.getElementsByTagName) {
        error('Host-meta is not an XML document, or doesnt have xml mimetype.');
        return;
      }
      var linkTags = data.getElementsByTagName('Link');
      if(linkTags.length == 0) {
        error('no Link tags found in host-meta');
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
                  templateParts = attr2.value.split('{uri}');
                  if(templateParts.length == 2) {
                    exports.ajax({
                      url: templateParts[0]+userAddress+templateParts[1],
                      success: function(data) {afterLrddSuccess(data, error, cb);},
                      error: function(data){afterLrddNoAcctError(data, error, cb);},
                    })
                  } else {
                    errorStr = 'the template doesn\'t contain "{uri}"';
                  }
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
      data = (new DOMParser()).parseFromString(data, 'text/xml');
      if(!data.getElementsByTagName) {
        error('Lrdd is not an XML document, or doesnt have xml mimetype.');
        return;
      }
      var linkTags = data.getElementsByTagName('Link');
      if(linkTags.length == 0) {
        error('no Link tags found in lrdd');
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
    };
  })();
});
