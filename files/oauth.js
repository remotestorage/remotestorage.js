  ///////////////////////////
 // OAuth2 implicit grant //
///////////////////////////

exports.oauth = (function() {
  function go(address, category, userAddress) {
    var loc = encodeURIComponent((''+window.location).split('#')[0]);
    window.location = address
      + ((address.indexOf('?') == -1)?'?':'&')
      + 'client_id=' + loc
      + '&redirect_uri=' + loc
      + '&scope=' + category
      + '&user_address=' + userAddress
      + '&response_type=token';
  }
  function harvestToken(cb) {
    if(location.hash.length == 0) {
      return;
    }
    var params = location.hash.split('&');
    var paramsToStay = [];
    for(var i = 0; i < params.length; i++){
      if(params[i].length && params[i][0] =='#') {
        params[i] = params[i].substring(1);
      }
      var kv = params[i].split('=');
      if(kv.length >= 2) {
        if(kv[0]=='access_token') {
          var token = unescape(kv[1]);//unescaping is needed in chrome, otherwise you get %3D%3D at the end instead of ==
          for(var i = 2; i < kv.length; i++) {
            token += '='+kv[i];
          }
          cb(token);
        } else if(kv[0]=='token_type') {
          //ignore silently
        } else {
          paramsToStay.push(params[i]);
        }
      } else {
        paramsToStay.push(params[i]);
      }
    }
    if(paramsToStay.length) {
      window.location='#'+paramsToStay.join('&');
    } else {
      window.location='';
    }
  }
  return {
    go: go,
    harvestToken: harvestToken,
    }
})();
