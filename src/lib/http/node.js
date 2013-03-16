define(['../util', 'http', 'https', 'url'], function(util, http, https, url) {

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
