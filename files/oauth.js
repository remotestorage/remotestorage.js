      ///////////////////////////
     // OAuth2 implicit grant //
    ///////////////////////////

    var oauth = (function() {
      function go(address, dataScope, userAddress) {
        var loc = encodeURIComponent((''+window.location).split('#')[0]);
        window.location = address
          + '?client_id=' + loc
          + '&redirect_uri=' + loc
          + '&scope=' + dataScope
          + '&user_address=' + userAddress
          + '&response_type=token';
      }
      function harvestToken(cb) {
        if(location.hash.length == 0) {
          return;
        }
        var params = location.hash.split('&');
        var paramsToStay = [];
        for(param in params){
          if(params[param].length && params[param][0] =='#') {
            params[param] = params[param].substring(1);
          }
          var kv = params[param].split('=');
          if(kv.length >= 2) {
            if(kv[0]=='access_token') {
              var token = kv[1];
              for(var i = 2; i < kv.length; i++) {
                token += '='+kv[i];
              }
              cb(token);
            } else if(kv[0]=='token_type') {
              //ignore silently
            } else {
              paramsToStay.push(params[param]);
            }
          } else {
            paramsToStay.push(params[param]);
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
    })()
