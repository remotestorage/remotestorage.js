define(
  ['./platform', './util'],
  function (platform, util) {

    "use strict";

    var logger = util.getLogger('getputdelete');

    var defaultContentType = 'application/octet-stream';

    var timeout = 10000;

    function realDoCall(method, url, body, mimeType, token) {
      return util.getPromise(function(promise) {
        logger.info(method, url);
        var platformObj = {
          url: url,
          method: method,
          timeout: timeout,
          headers: {}
        };

        if(token) {
          platformObj.headers['Authorization'] = 'Bearer ' + token;
        }
        if(mimeType) {
          if(typeof(body) == 'object' && body instanceof ArrayBuffer) {
            mimeType += '; charset=binary';
          }
          platformObj.headers['Content-Type'] = mimeType;
        }

        platformObj.fields = {withCredentials: 'true'};
        if(method != 'GET') {
          platformObj.data = body;
        }

        platform.ajax(platformObj).
          then(function(data, headers) {
            var contentType = headers['content-type'] || defaultContentType;
            var mimeType = contentType.split(';')[0]

            if(contentType.match(/charset=binary/)) {
              data = util.rawToBuffer(data);
            } else if(mimeType === 'application/json') {
              try {
                data = JSON.parse(data);
              } catch(exc) {
                // ignore invalid JSON
              }
            }

            promise.fulfill(data, mimeType);            
          }, function(error) {
            if(error === 404) {
              return promise.fulfill(undefined);
            } else if(error === 401 || error === 403) {
              error = 'unauthorized';
            };
            promise.reject(error);
          });
      });
    }

    var inProgress = 0;
    var maxInProgress = 10;
    var pendingQueue = [];

    function doCall() {
      var args = util.toArray(arguments);
      function finishOne() {
        inProgress--;
        if(pendingQueue.length > 0) {
          var c = pendingQueue.shift();
          doCall.apply(this, c.a).then(c.p.fulfill, c.p.reject);
        } else {
        }
      }
      if(inProgress < maxInProgress) {
        inProgress++;
        return realDoCall.apply(this, arguments).then(function(data, mimeType) {
          finishOne();
          return util.getPromise(function(p) { p.fulfill(data, mimeType); });
        }, function(error) {
          finishOne();
          throw error;
        });
      } else {
        return util.getPromise(function(p) {
          pendingQueue.push({
            a: args,
            p: p
          });
        });
      }
    }

    function get(url, token) {
      return doCall('GET', url, null, null, token);
    }

    function put(url, value, mimeType, token) {
      if(! (typeof(value) === 'string' || (typeof(value) === 'object' &&
                                           value instanceof ArrayBuffer))) {
        throw new Error("invalid value given to PUT, only strings or ArrayBuffers allowed, got " + typeof(value));
      }
      return doCall('PUT', url, value, mimeType, token);
    }

    function set(url, valueStr, mimeType, token) {
      if(typeof(valueStr) == 'undefined') {
        return doCall('DELETE', url, null, null, token);
      } else {
        return put(url, valueStr, mimeType, token);
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
      set:    set,

      setTimeout: function(t) {
        timeout = t;
      },

      getTimeout: function() {
        return timeout;
      }

    };
});
