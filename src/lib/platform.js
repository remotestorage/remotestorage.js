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
    if(typeof(params.data) === 'string') {
      xhr.send(params.data);
    } else {
      xhr.send();
    }
  }
  function ajaxExplorer(params) {
    //this won't work, because we have no way of sending the Authorization header. It might work for GET to the 'public' category, though.
    var xdr=new XDomainRequest();
    xdr.timeout=params.timeout || 3000;//is this milliseconds? documentation doesn't say
    xdr.open(params.method, params.url);
    xdr.onload=function() {
      if(xdr.status==200 || xdr.status==201 || xdr.status==204) {
        params.success(xhr.responseText);
      } else {
        params.error(xhr.status);
      }
    };
    xdr.onerror = function() {
      err('unknown error');//See http://msdn.microsoft.com/en-us/library/ms536930%28v=vs.85%29.aspx
    };
    xdr.ontimeout = function() {
      err(timeout);
    };
    if(params.data) {
      xdr.send(params.data);
    } else {
      xdr.send();
    }
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
    var options = {
      method: params.method,
      host: urlObj.hostname,
      path: urlObj.path,
      port: (urlObj.port?port:(urlObj.protocol=='https:'?443:80)),
      headers: params.headers
    };
    var timer, timedOut;
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
            params.success(str);
          } else {
            params.error(response.statusCode);
          }
        }
      });
    });
    request.on('error', function(e) {
      params.error(e.message);
    });
    if(params.timeout) {
      timer = setTimeout(function() {
        params.error('timeout');
        timedOut=true;
      }, params.timeout);
    }
    if(params.data) {
      request.end(params.data);
    } else {
      request.end();
    }
  }
  function parseXmlBrowser(str, cb) {
    var tree=(new DOMParser()).parseFromString(str, 'text/xml')
    var nodes=tree.getElementsByTagName('Link');
    var obj={
      Link: []
    };
    for(var i=0; i<nodes.length; i++) {
      var link={};
      for(var j=0; j<nodes[i].attributes.length;j++) {
        link[nodes[i].attributes[j].name]=nodes[i].attributes[j].value;
      }
      if(link['rel']) {
        obj.Link.push({
          '@': link
        });
      }
    }
    cb(null, obj);
  }
  function parseXmlNode(str, cb) {
    var xml2js=require('xml2js');
    new xml2js.Parser().parseString(str, cb);
  }
  if(typeof(window) === 'undefined') {
    return {
      ajax: ajaxNode,
      parseXml: parseXmlNode
    }
  } else {
    if(window.XDomainRequest) {
      return {
        ajax: ajaxExplorer,
        parseXml: parseXmlBrowser
      }
    } else {
      return {
        ajax: ajaxBrowser,
        parseXml: parseXmlBrowser
      }
    }
  }
});
