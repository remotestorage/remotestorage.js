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
      if((xhr.readyState == 4) && (!timedOut)) {
        if(timer) {
          window.clearTimeout(timer);
        }
        if(xhr.status == 200 || xhr.status == 201 || xhr.status == 204) {
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
    params.error('not implemented');
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
