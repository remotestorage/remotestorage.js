define(
  ['./platform', './util'],
  function (platform, util) {

    "use strict";

    var logger = util.getLogger('getputdelete');

    var defaultContentType = 'application/octet-stream';

    function getContentType(headers) {
      if(headers['content-type']) {
        return headers['content-type'];
      } else {
        logger.error("Falling back to default content type: ", defaultContentType, JSON.stringify(headers));
        return defaultContentType;
      }
    }

    function doCall(method, url, value, mimeType, token, cb, deadLine) {
      logger.debug(method, url);
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          if(err == 401) {
            err = 'unauthorized';
          } else if(err != 404) {
            logger.error(method + ' ' + url + ': ', err);
          }
          cb(err);
        },
        success: function(data, headers) {
          //logger.debug('doCall cb '+url, 'headers:', headers);
          var mimeType = getContentType(headers);

          if(mimeType.match(/charset=binary/)) {
            data = util.rawToBuffer(data);
          }

          cb(null, data, mimeType.split(';')[0]);
        },
        timeout: deadLine || 5000,
        headers: {}
      };

      if(token) {
        platformObj.headers['Authorization'] = 'Bearer ' + token;
      }
      if(mimeType) {
        if(typeof(value) == 'object' && value instanceof ArrayBuffer) {
          mimeType += '; charset=binary';
        }
        platformObj.headers['Content-Type'] = mimeType;
      }

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }
      //logger.debug('platform.ajax '+url);
      platform.ajax(platformObj);
    }

    function get(url, token, cb) {
      doCall('GET', url, null, null, token, function(err, data, mimetype) {
        if(err == 404) {
          cb(null, undefined);
        } else if(err) {
          cb(err);
        } else {
          if(util.isDir(url)) {
            try {
              data = JSON.parse(data);
            } catch (e) {
              cb('unparseable directory index: ' + data);
              return;
            }
          }
          cb(null, data, mimetype);
        }
      });
    }

    function put(url, value, mimeType, token, cb) {
      if(! (typeof(value) === 'string' || (typeof(value) === 'object' &&
                                           value instanceof ArrayBuffer))) {
        cb(new Error("invalid value given to PUT, only strings allowed, got "
                     + typeof(value)));
      }

      doCall('PUT', url, value, mimeType, token, function(err, data) {
        //logger.debug('cb from PUT '+url);
        cb(err, data);
      });
    }

    function set(url, valueStr, mimeType, token, cb) {
      if(typeof(valueStr) == 'undefined') {
        doCall('DELETE', url, null, null, token, cb);
      } else {
        put(url, valueStr, mimeType, token, cb);
      }
    }

    // Namespace: getputdelete
    return {
      //
      // Method: get
      //
      // Send a GET request to a given path.
      //
      // Parameters:
      //   url      - url to send request to
      //   token    - bearer token used to authorize the request
      //   callback - callback called to signal success or failure
      //
      // Callback parameters:
      //   err      - error message(s). if no error occured, err is null.
      //   data     - raw response data
      //   mimeType - value of the response's Content-Type header. If none was returned, this defaults to application/octet-stream.
      get:    get,

      //
      // Method: set
      //
      // Send a PUT or DELETE request to given path.
      //
      // Parameters:
      //   url      - url to send request to
      //   data     - optional data to send. if data is undefined (not null!), a DELETE request is used.
      //   mimeType - MIME type to set for the data via the Content-Type header. Only relevant for PUT.
      //   token    - bearer token used to authorize the request
      //   callback - callback called to signal success or failure
      //
      // Callback parameters:
      //   err      - error message(s). if no error occured, err is null.
      //   data     - raw response data
      //   mimeType - value of the response's Content-Type header. If none was returned, this defaults to application/octet-stream.
      //
      set:    set
    };
});
