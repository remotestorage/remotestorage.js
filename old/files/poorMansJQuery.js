      function _tryConnect() {
        oauth.harvestToken(function(token) {
          backend.setToken(token);
        });
        var configuration = remoteStorage.configure();
        backend.connect(configuration.userAddress, configuration.category, function() {
          work();
        });
      }


      ///////////////////////
     // poor man's jQuery //
    ///////////////////////

    //implementing $(document).ready(embody):
    document.addEventListener('DOMContentLoaded', function() {
      document.removeEventListener('DOMContentLoaded', arguments.callee, false );
      {
        var scripts = document.getElementsByTagName('script');
        for(i in scripts) {
          if((new RegExp(jsFileName+'$')).test(scripts[i].src)) {
            var options = (new Function('return ' + scripts[i].innerHTML.replace(/\n|\r/g, '')))();
            window.remoteStorage.configure(options);
          }
        }
        _tryConnect();
      }
    }, false)

    //implementing $.ajax():
    function ajax(params) {
      var xhr = new XMLHttpRequest();
      if(!params.method) {
        params.method='GET';
      }
      if(!params.data) {
        params.data = null;
      }
      xhr.open(params.method, params.url, true);
      if(params.headers) {
        for(var header in params.headers) {
          xhr.setRequestHeader(header, params.headers[header]);
        }
      }
//      if(params.fields) {
//        for(var field in params.fields) {
//          xhr[field] = params.fields[field];
//        }
//      }
      xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
          if(xhr.status == 0) {
            //alert('looks like '+params.url+' has no CORS headers on it! try copying this scraper and that file both onto your localhost')
            params.error(xhr);
          } else {
            params.success(xhr.responseText);
          }
        }
      }
      xhr.send(params.data);
    }

    //implementing $():
    function $(str) {
      return document.getElementById(str);
    }
