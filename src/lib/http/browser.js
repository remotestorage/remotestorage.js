define(['../util'], function(util) {

  var logger = util.getLogger('http::browser');

  var RESPONSE_HEADER_KEYS = ['Content-Type', 'ETag'];

  function loadResponseHeaders(xhr) {
    var headers = {};
    RESPONSE_HEADER_KEYS.forEach(function(key) {
      headers[key.toLowerCase()] = xhr.getResponseHeader(key);
    });
    return headers;
  }

  /**
   * Function: BrowserHTTP
   * HTTP implementation backed by <XMLHttpRequest at https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest>
   * with <CORS at http://www.w3.org/TR/cors/> support.
   *
   * Parameters:
   *   method  - the HTTP verb to use
   *   uri     - full URI to request
   *   headers - Object of request headers to set
   *   body    - (optional) request body to send along
   *
   * Returns a promise, fulfilled with an object containing:
   *   status  - a Number, status code returned by HTTP server
   *   body    - the response body as a String
   *   headers - Object of response headers
   */
  function http(method, uri, headers, body) {
    logger.debug(method, uri, headers, body);
    return util.getPromise(function(promise) {
      // open XHR
      var xhr = new XMLHttpRequest();
      xhr.open(method, uri, true);
      // set headers
      for(var key in headers) {
        xhr.setRequestHeader(key, headers[key]);
      }

      // success
      function succeed() {
        promise.fulfill({
          status: xhr.status,
          body: xhr.responseText,
          headers: loadResponseHeaders(xhr)
        });
      }      
      xhr.addEventListener('load', succeed);

      // error
      xhr.addEventListener('error', function(error) {
        if(xhr.status) {
          // whenever we have a 'status', we consider it success. other layers can
          // take care of interpretation of the status.
          succeed();
        } else {
          promise.reject(error);
        }
      });

      xhr.send(body);

    });
  }

  return http;

});
