
  ///////////////
 // Webfinger //
///////////////

exports.webfinger = (function(){
  var userAddress, userName, host, templateParts;//this is all a bit messy, but there are a lot of callbacks here, so globals help us with that.
  function getDavBaseAddress(ua, error, cb){
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
        ajax({
          //url: 'https://'+host+'/.well-known/host-meta',
          url: 'http://'+host+'/.well-known/host-meta',
          success: function(data) {
            afterHttpsHostmetaSuccess(data, error, cb);
          },
          error: function(data) {
            afterHttpsHostmetaError(data, error, cb);
          },
        })
      }
    }
  }
  function afterHttpsHostmetaSuccess(data, error, cb) {
    //error('Https Host-meta found.');
    continueWithHostmeta(data, error, cb);
  }

  function afterHttpsHostmetaError(data, error, cb) {
        //error('Https Host-meta error. Trying http.');
        ajax({
          url: 'http://'+host+'/.well-known/host-meta',
          success: function(data) {
            afterHttpHostmetaSuccess(data, error, cb);
          },
          error: function(data) {
            afterHttpHostmetaError(data, error, cb);
          },
        })
  }

  function afterHttpHostmetaSuccess(data, error, cb) {
    //error('Http Host-meta found.');
    continueWithHostmeta(data, error, cb);
  }

  function afterHttpHostmetaError(data, error, cb) {
    error('Cross-origin host-meta failed. Trying through proxy');
    //$.ajax(
    //  { url: 'http://useraddress.net/single-origin-webfinger...really?'+ua
    //   , success: afterWebfingerSuccess
    //   , error: afterProxyError
    //  })
  }

  function continueWithHostmeta(data, error, cb) {
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
      for(var linkTagI in linkTags) {
        for(var attrI in linkTags[linkTagI].attributes) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='lrdd')) {
            lrddFound = true;
            errorStr = 'the first Link tag with a lrdd rel-attribute has no template-attribute';
            for(var attrJ in linkTags[linkTagI].attributes) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                templateParts = attr2.value.split('{uri}');
                if(templateParts.length == 2) {
                  ajax({
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
    ajax({
      url: templateParts[0]+'acct:'+ua+templateParts[1],
      success: function() {afterLrddSuccess(error, cb);},
      error: function() {afterLrddAcctError(error, cb);}
    })
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
      for(var linkTagI in linkTags) {
        for(var attrI in linkTags[linkTagI].attributes) {
          var attr = linkTags[linkTagI].attributes[attrI];
          if((attr.name=='rel') && (attr.value=='remoteStorage')) {
            linkFound = true;
            errorStr = 'the first Link tag with a dav rel-attribute has no template-attribute';
            var authAddress, kvAddress, api;
            for(var attrJ in linkTags[linkTagI].attributes) {
              var attr2 = linkTags[linkTagI].attributes[attrJ];
              if(attr2.name=='template') {
                rStemplate = attr2.value;
              }
              if(attr2.name=='auth') {
                rSauth = attr2.value;
              }
              if(attr2.name=='api') {
                rSapi = attr2.value;
              }
            }
            break;
          }
        }
        if(linkFound) {
          cb(rSauth, rStemplate, rSapi);
          break;
        }
      }
      if(!linkFound) {
        error(errorStr);
      }
    }
  }
  return {getDavBaseAddress: getDavBaseAddress};
})()
