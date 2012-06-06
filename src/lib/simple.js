define(
  ['./platform'],
  function (platform) {
    function doCall(method, url, value, token, cb, deadLine) {
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          cb(err);
        },
        success: function(data) {
          cb(null, data);
        },
        timeout: 3000
      }

      platformObj.headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'text/plain;charset=UTF-8'
      };

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }

      platform.ajax(platformObj);
    }

    function get(url, token, cb) {
      doCall('GET', url, null, token, function(err, data) {
        if(err == 404) {
          cb(null, undefined);
        } else {
          if(url.substr(-1)=='/') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              cb('unparseable directory index');
              return;
            }
          }
          cb(err, data);
        }
      });
    }

    function put(url, value, token, cb) {
      doCall('PUT', url, value, token, function(err, data) {
        if(err == 404) {
          doPut(url, value, token, 1, cb);
        } else {
          cb(err, data);
        }
      });
    }

    function delete_(url, token, cb) {
      doCall('DELETE', url, null, token, cb);
    }

    return {
      get:    get,
      put:    put,
      delete: delete_
    }
});
