define(['../util'], function(util) {

  var logger = util.getLogger('http::browser');

  // Firefox' getAllResponseHeaders is broken for CORS requests since forever.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
  // Any additional headers that are needed by other code, should be added here. 
  var ESSENTIAL_HEADERS = ['Content-Type', 'ETag'];

  function parseHeaders(rawHeaders) {
    if(! rawHeaders) {
      // firefox bug. workaround in ajaxBrowser.
      return null;
    }
    var headers = {};
    var lines = rawHeaders.split(/\r?\n/);
    var lastKey = null, md, key, value;
    var numLines = lines.length;
    for(var i=0;i<numLines;i++) {
      if(lines[i].length === 0) {
        // empty line. obviously.
        continue;
      } else if((md = lines[i].match(/^([^:]+):\s*(.+)$/))) {
        // key/value line
        key = md[1].toLowerCase(), value = md[2];
        headers[key] = value;
        lastKey = key;
      } else if((md = lines[i].match(/^\s+(.+)$/))) {
        // continued line (if previous line exceeded 80 bytes)
        key = lastKey, value= md[1];
        headers[key] = headers[key] + value;
      } else {
        // nothing we recognize.
        logger.error("Failed to parse header line: " + lines[i]);
      }
    }
    return headers;
  }

  function loadResponseHeaders(xhr) {
    var headers = parseHeaders(xhr.getAllResponseHeaders());
    if(! headers) {
      headers = {};
      ESSENTIAL_HEADERS.forEach(function(key) {
        headers[key.toLowerCase()] = xhr.getResponseHeader(key);
      });
    }
    return headers;
  }

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
