
        //////////////////
       // DOM API shim //
      //////////////////

      function calcLength() {
        var len = 0;
        for(var i=0; i<localStorage.length; i++) {
          if(localStorage.key(i).substring(0,15)=='_remoteStorage_') {
            len++;
          }
        }
        return len;
      }

