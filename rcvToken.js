(function() {
  if(location.hash.length == 0) {
    return;
  }
  var params = location.hash.split('&');
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
        localStorage.setItem('_shadowBackendToken', token);
        try {
          var sessionObj = JSON.parse(localStorage.getItem('sessionObj'));
          sessionObj.bearerToken = token;
          localStorage.setItem('sessionObj', JSON.stringify(sessionObj));
        } catch(e) {
        }
        window.close();
      }
    }
  }
})();
