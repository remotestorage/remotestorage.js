define(
  ['./platform'],
  function (platform) {
    function doCall(method, url, value, token, cb, deadLine) {
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          if(err == 404) {
            cb(null, undefined);
          } else {
            cb(err, null);
          }
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
      doCall('GET', url, null, token, cb);
    }

    function put(url, value, token, cb) {
      doCall('PUT', url, value, token, cb);
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
