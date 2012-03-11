define([], function() {
  function ajaxBrowser(params) {
    var timedOut = false;
    var timer;
    if(params.timeout) {
      timer = window.setTimeout(function() {
        timedOut = true;
        params.error('timeout');
      }, params.timeout);
    }
    var xhr = new XMLHttpRequest();
    if(!params.method) {
      params.method='GET';
    }
    if(!params.data) {
      params.data = null;
    }
    xhr.open(params.method, params.url, true);
    if(params.headers) {
      for(var header in params.headers) {
        xhr.setRequestHeader(header, params.headers[header]);
      }
    }
    xhr.onreadystatechange = function() {
      if((xhr.readyState==4) && (!timedOut)) {
        if(timer) {
          window.clearTimeout(timer);
        }
        if(xhr.status==200 || xhr.status==201 || xhr.status==204) {
          params.success(xhr.responseText);
        } else {
          params.error(xhr.status);
        }
      }
    }
    xhr.send(params.data);
  }
  function ajaxExplorer(params) {
    params.error('not implemented');
  }
  function ajaxNode(params) {
    var http=require('http'),
      https=require('https'),
      url=require('url');
    if(!params.method) {
      params.method='GET';
    }
    if(!params.data) {
      params.data = null;
    }
    var urlObj = url.parse(params.url);
    console.log(urlObj);
    var options = {
      method: params.method,
      host: urlObj.hostname,
      path: urlObj.path,
      port: (urlObj.port?port:(urlObj.protocol=='https:'?443:80)),
      headers: params.headers
    };
    var timer, timedOut;
    console.log(params);
    console.log(options);
    var lib = (urlObj.protocol=='https:'?https:http);
    var request = lib.request(options, function(response) {
      var str='';
      response.setEncoding('utf8');
      response.on('data', function(chunk) {
        str+=chunk;
      });
      response.on('end', function() {
        console.log('reply came:');
        console.log(response.status);
        console.log(str);
        if(timer) {
          clearTimeout(timer);
        }
        if(!timedOut) {
          if(response.statusCode==200 || response.statusCode==201 || response.statusCode==204) {
            console.log(str);
            console.log('it is a success');
            params.success(str);
          } else {
            console.log(response.statusCode);
            console.log('it is an error');
            params.error(response.statusCode);
          }
        }
      });
    });
    if(params.timeout) {
      timer = setTimeout(function() {
        params.error('timeout');
        timedOut=true;
      }, params.timeout);
    }
    if(params.data) {
      console.log('it is a timeout');
      request.end(params.data);
    } else {
      request.end();
    }
  }
  function parseXml(str) {
    return (new DOMParser()).parseFromString(str, 'text/xml');
  }
  if(typeof(window) === 'undefined') {
    return {
      ajax: ajaxNode,
      parseXml: parseXml
    }
  } else {
    if(window.XDomainRequest) {
      return {
        ajax: ajaxExplorer,
        parseXml: parseXml
      }
    } else {
      return {
        ajax: ajaxBrowser,
        parseXml: parseXml
      }
    }
  }
});
