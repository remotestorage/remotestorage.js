/*global window */
/*global console */
/*global XMLHttpRequest */
/*global XDomainRequest */
/*global Blob */
/*global setTimeout */
/*global clearTimeout */
/*global DOMParser */
/*global Element */
/*global document */

if(typeof(global) !== 'undefined' && typeof(nodeRequire) === 'undefined') {
  // some node versions seem to have "global.require" set, while others make
  // "require" a module-local variable.
  var nodeRequire = global.require || require;
}

define(['./util'], function(util) {

  "use strict";

  // Namespace: platform
  //
  // Platform specific implementations of common things to do.
  //
  // Method: ajax
  //
  // Set off an HTTP request.
  // Uses CORS, if available on the platform.
  //
  // Parameters:
  //   (given as an *Object*)
  //
  //   url     - URL to send the request to
  //   success - callback function to call when request succeeded
  //   error   - callback function to call when request failed
  //   method  - (optional) HTTP request method to use (default: GET)
  //   headers - (optional) object containing request headers to set
  //   timeout - (optional) milliseconds until request is given up and error
  //             callback is called. If omitted, the request never times out.
  //
  // Example:
  //   (start code)
  //   platform.ajax({
  //     url: "http://en.wikipedia.org/wiki/AJAX",
  //     success: function(responseText, responseHeaders) {
  //       console.log("Here's the page: ", responseText);
  //     },
  //     error: function(errorMessage) {
  //       console.error("Something went wrong: ", errorMessage);
  //     },
  //     timeout: 3000
  //   });
  //   (end code)
  //
  // Platform support:
  //   web browser - YES (if browser <supports CORS at http://caniuse.com/#feat=cors>)
  //   IE - Partially, no support for setting headers.
  //   node - YES, CORS not an issue at all
  //
  //
  // Method: parseXml
  //
  // Parse given XML source.
  //
  // Platform support:
  //   browser - yes, if DOMParser is available
  //   node - yes, if xml2js is available
  //

  var logger = util.getLogger('platform');

  // downcase all header keys
  function normalizeHeaders(headers) {
    var h = {};
    for(var key in headers) {
      h[key.toLowerCase()] = headers[key];
    }
    return h;
  }

  function browserParseHeaders(rawHeaders) {
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
        // The escaped colon in the following (previously added) comment is
        // necessary, to prevent NaturalDocs from generating a toplevel
        // document called "value line" to the documentation. True story.

        // key\: value line
        key = md[1], value = md[2];
        headers[key] = value;
        lastKey = key;
      } else if((md = lines[i].match(/^\s+(.+)$/))) {
        // continued line (if previous line exceeded 80 bytes
        key = lastKey, value= md[1];
        headers[key] = headers[key] + value;
      } else {
        // nothing we recognize.
        logger.error("Failed to parse header line: " + lines[i]);
      }
    }
    return normalizeHeaders(headers);
  }

  var successStates = { 200:true, 201:true, 204:true, 207:true };

  function isSuccessful(xhr) {
    return !! successStates[xhr.status];
  }

  function ajaxBrowser(params) {
    return util.getPromise(function(promise) {
      var timedOut = false;
      var timer;
      var xhr = new XMLHttpRequest();
      if(params.timeout) {
        timer = window.setTimeout(function() {
          timedOut = true;
          xhr.abort();
          promise.reject('timeout');
        }, params.timeout);
      }

      if(!params.method) {
        params.method = 'GET';
      }

      xhr.open(params.method, params.url, true);

      if(params.headers) {
        for(var header in params.headers) {
          xhr.setRequestHeader(header, params.headers[header]);
        }
      }

      xhr.onreadystatechange = function() {
        if((xhr.readyState == 4)) {
          if(timedOut) {
            return;
          }
          if(timer) {
            window.clearTimeout(timer);
          }
          if(isSuccessful(xhr)) {
            logger.debug("REQUEST SUCCESSFUL", params.url, xhr.responseText);
            var headers = browserParseHeaders(xhr.getAllResponseHeaders());
            if(! headers) {
              // Firefox' getAllResponseHeaders is broken for CORS requests since forever.
              // https://bugzilla.mozilla.org/show_bug.cgi?id=608735
              // Any additional headers that are needed by other code, should be added here.
              headers = {
                'content-type': xhr.getResponseHeader('Content-Type')
              };
            }
            promise.fulfill(xhr.responseText, headers);
          } else {
            logger.debug("REQUEST FAILED", xhr.status, params.url);
            promise.reject(xhr.status || 'network error');
          }
        }
      };

      xhr.send(params.data);
    });
  }

  function ajaxExplorer(params) {
    // this won't work, because we have no way of sending
    // the Authorization header. It might work for GET to
    // the 'public' category, though.
    var promise = util.getPromise();
    var xdr = new XDomainRequest();
    xdr.timeout = params.timeout || 3000;//is this milliseconds? documentation doesn't say
    xdr.open(params.method, params.url);
    xdr.onload = function() {
      if(xdr.status == 200 || xdr.status == 201 || xdr.status == 204) {
        promise.fulfill(xdr.responseText);
      } else {
        params.reject(xdr.status);
      }
    };
    xdr.onerror = function() {
      // See http://msdn.microsoft.com/en-us/library/ms536930%28v=vs.85%29.aspx
      promise.reject('network error');
    };
    xdr.ontimeout = function() {
      promise.reject('timeout');
    };
    if(params.data) {
      xdr.send(params.data);
    } else {
      xdr.send();
    }
  }

  function ajaxNode(params) {

    return util.getPromise(function(promise) {

      if(typeof(params.data) === 'object' && params.data instanceof ArrayBuffer) {
        throw new Error("Sending binary data not yet implemented for nodejs");
      }

      var http=nodeRequire('http'),
      https=nodeRequire('https'),
      url=nodeRequire('url');
      if(!params.method) {
        params.method='GET';
      }
      if(params.data) {
        params.headers['content-length'] = params.data.length;
      } else {
        params.data = null;
      }
      var urlObj = url.parse(params.url);
      var options = {
        method: params.method,
        host: urlObj.hostname,
        path: urlObj.path,
        port: (urlObj.port ? urlObj.port : (urlObj.protocol=='https:'?443:80)),
        headers: params.headers
      };
      var timer, timedOut;

      if(params.timeout) {
        timer = setTimeout(function() {
          promise.reject('timeout');
          timedOut=true;
        }, params.timeout);
      }

      var lib = (urlObj.protocol=='https:'?https:http);
      var request = lib.request(options, function(response) {
        var str='';
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
          str+=chunk;
        });
        response.on('end', function() {
          if(timer) {
            clearTimeout(timer);
          }
          if(!timedOut) {
            if(response.statusCode==200 || response.statusCode==201 || response.statusCode==204) {
              promise.fulfill(str, normalizeHeaders(response.headers));
            } else {
              promise.reject(response.statusCode);
            }
          }
        });
      });
      request.on('error', function(e) {
        if(timer) {
          clearTimeout(timer);
        }
        promise.reject(e && e.message);
      });
      if(params.data) {
        request.end(params.data);
      } else {
        request.end();
      }
    });
  }

  function parseXmlBrowser(str, cb) {
    var tree=(new DOMParser()).parseFromString(str, 'text/xml');
    var nodes=tree.getElementsByTagName('Link');
    var obj={
      Link: []
    };
    for(var i=0; i<nodes.length; i++) {
      var link={};
      if(nodes[i].attributes) {
        for(var j=0; j<nodes[i].attributes.length;j++) {
          link[nodes[i].attributes[j].name]=nodes[i].attributes[j].value;
        }
      }
      var props = nodes[i].getElementsByTagName('Property');
      link.properties = {};
      for(var k=0; k<props.length;k++) {
        link.properties[
          props[k].getAttribute('type')
        ] = props[k].childNodes[0].nodeValue;
      }
      if(link.rel) {
        obj.Link.push({
          '@': link
        });
      }
    }
    cb(null, obj);
  }

  function parseXmlNode(str, cb) {
    var xml2js=nodeRequire('xml2js');
    new xml2js.Parser().parseString(str, cb);
  }

  var platform;

  if(typeof(window) === 'undefined') {
    platform = {
      ajax: ajaxNode,
      parseXml: parseXmlNode
    };
  } else {
    if(window.XDomainRequest) {
      platform = {
        ajax: ajaxExplorer,
        parseXml: parseXmlBrowser
      };
    } else {
      platform = {
        ajax: ajaxBrowser,
        parseXml: parseXmlBrowser
      };
    }
  }

  return platform;
});
