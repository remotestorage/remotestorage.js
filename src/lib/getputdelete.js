define(
  ['./platform', './util'],
  function (platform, util) {

    var logger = util.getLogger('getputdelete');

    function doCall(method, url, value, mimeType, token, cb, deadLine) {
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          cb(err);
        },
        success: function(data, headers) {
          logger.debug('doCall cb '+url);
          cb(null, data, new Date(headers['Last-Modified']).getTime(), headers['Content-Type']);
        },
        timeout: 3000
      }

      platformObj.headers = {
        'Authorization': 'Bearer ' + token
      }
      if(mimeType) {
        platformObj.headers['Content-Type'] = mimeType;
      }

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }
      logger.debug('platform.ajax '+url);
      platform.ajax(platformObj);
    }

    function get(url, token, cb) {
      doCall('GET', url, null, null, token, function(err, data, timestamp, mimetype) {
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
          cb(err, data, timestamp, mimetype);
        }
      });
    }

    function put(url, value, mimeType, token, cb) {
      logger.info('calling PUT '+url);
      doCall('PUT', url, value, mimeType, token, function(err, data) {
        logger.debug('cb from PUT '+url);
        if(err == 404) {
          doPut(url, value, token, 1, cb);
        } else {
          cb(err, data);
        }
      });
    }

    function set(url, valueStr, mimeType, token, cb) {
      if(typeof(valueStr) == 'undefined') {
        doCall('DELETE', url, null, null, token, cb);
      } else {
        put(url, valueStr, mimeType, token, cb);
      }
    }

    return {
      get:    get,
      set:    set
    }
});
