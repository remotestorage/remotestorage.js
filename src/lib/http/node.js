define(['../util', 'http', 'https', 'url'], function(util, http, https, url) {


  /**
   * Function: NodeHTTP
   * HTTP implementation backed by node's <http at http://nodejs.org/api/http.html> and <https at http://nodejs.org/api/https.html> modules.
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
    return util.getPromise(function(promise) {
      var requestOptions = util.extend(url.parse(uri), {
        method: method,
        headers: headers
      });
      var lib = (requestOptions.protocol === 'https:' ? https : http);
      var request = lib.request(requestOptions, function(response) {
        var responseBody = '';
        response.on('data', function(chunk) {
          responseBody += chunk;
        });

        response.on('end', function() {
          promise.fulfill({
            status: response.statusCode,
            headers: response.headers,
            body: responseBody
          });
        });
      });
      request.on('error', promise.reject);
      request.end(body);
    });
  }

  return http;
});
