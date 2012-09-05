
var config = require('./config').config;

exports.handler = (function() {
  var url=require('url'),
    crypto=require('crypto'),
    tokens = {}, lastModified = {}, contentType = {}, content = {};
  function createToken(userName, scopes, cb) {
    var scopePaths=[];
    crypto.randomBytes(48, function(ex, buf) {
      var token = buf.toString('hex');
      for(var i=0; i<scopes.length; i++) {
        var thisScopeParts = scopes[i].split(':');
        if(thisScopeParts[0]=='') {
          scopePaths.push(userName+'/:'+thisScopeParts[1]);
        } else {
          scopePaths.push(userName+'/'+thisScopeParts[0]+'/:'+thisScopeParts[1]);
          scopePaths.push(userName+'/public/'+thisScopeParts[0]+'/:'+thisScopeParts[1]);
        }
      }
      tokens[token] = scopePaths;
      cb(token);
    });
  }
  function mayRead(authorizationHeader, path) {
    if(authorizationHeader) {
      var scopes = tokens[authorizationHeader.substring('Bearer '.length)];
      if(scopes) {
        for(var i=0; i<scopes.length; i++) {
          var scopeParts = scopes[i].split(':');
          if(path.substring(0, scopeParts[0].length)==scopeParts[0]) {
            return true;
          } else {
            console.log(path.substring(0, scopeParts[0].length)+' != '+ scopeParts[0]);
          }
        }
      }
    } else {
      var pathParts = path.split('/');
      return (pathParts[0]=='' && pathParts[2]=='public' && path.substr(-1) != '/');
    }
  }
  function mayWrite(authorizationHeader, path) {
    if(authorizationHeader) {
      var scopes = tokens[authorizationHeader.substring('Bearer '.length)];
      if(scopes) {
        for(var i=0; i<scopes.length; i++) {
          var scopeParts = scopes[i].split(':');
          if(scopeParts.length==2 && scopeParts[1]=='rw' && path.substring(0, scopeParts[0].length)==scopeParts[0]) {
            return true;
          }
        }
      }
    }
  }
  function writeHead(res, status, origin, timestamp, contentType) {
    var headers = {
      'access-control-allow-origin': (origin?origin:'*'),
      'access-control-allow-headers': 'content-type, authorization, origin',
      'access-control-allow-methods': 'GET, PUT, DELETE',
    };
    if(timestamp) {
      headers['last-modified']= new Date(timestamp).toString();
    }
    if(contentType) {
      headers['content-type']= contentType;
    }
    res.writeHead(status, headers);
  }
  function writeRaw(res, contentType, content, origin, timestamp) {
    console.log('access-control-allow-origin:'+ (origin?origin:'*'));
    console.log(contentType);
    console.log(content);
    writeHead(res, 200, origin, timestamp, contentType);
    res.write(content);
    res.end();
  }
  function writeJson(res, obj, origin, timestamp) {
    writeRaw(res, 'application/json', JSON.stringify(obj), origin, timestamp);
  }
  function writeHtml(res, html) {
    res.writeHead(200, {
      'content-type': 'text/html'
    });
    res.write('<!DOCTYPE html lang="en"><head><title>'+config.host+'</title><meta charset="utf-8"></head><body>'+html+'</body></html>');
    res.end();
  }
  function give404(res, origin) {
    console.log('404');
    console.log(content);
    writeHead(res, 404, origin, 'now');
    res.end();
  }
  function computerSaysNo(res, origin) {
    console.log('COMPUTER_SAYS_NO');
    console.log(tokens);
    writeHead(res, 401, origin, 'now');
    res.end();
  }

  function toHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function portal(urlObj, res) {
    res.writeHead(200, {
      'content-type': 'text/html'
    });
    res.write('<!DOCTYPE html lang="en"><head><title>'+config.host+'</title><meta charset="utf-8"></head><body><ul>');
    var scopes = {
      'http://todomvc.michiel.5apps.com/': ['tasks:rw'],
      'http://litewrite.michiel.5apps.com/': ['documents:rw'],
      'http://docrastinate.michiel.5apps.com/': ['documents:rw'],
      'http://expenses.michiel.5apps.com/': ['money:rw'],
      'http://evanw-continuous-calendar.michiel.5apps.com/': ['calendar:rw'],
      'http://seven20.epic720.5apps.com/manage.htm': [':rw']
    };
    var outstanding = 0;
    for(var i in scopes) {
      outstanding++;
      (function(i) {
        createToken(config.defaultUserName, scopes[i], function(token) {
          res.write('<li><a href="'+i+'#storage_root=http://'+config.host+'/storage/'+config.defaultUserName
            //+'&authorize_endpoint=http://'+config.host+'/auth/'+config.defaultUserName+'">'+i+'</a></li>');
            +'&access_token='+token+'">'+i+'</a></li>');
          outstanding--;
          if(outstanding==0) {
            res.write('</ul></body></html>');
            res.end();
          }
        });
      })(i);
    }
  }
  function webfinger(urlObj, res) {
    console.log('WEBFINGER');
    if(urlObj.query['resource']) {
      userAddress = urlObj.query['resource'].substring('acct:'.length);
      userName = userAddress.split('@')[0];
    }
    writeJson(res, {
      links:[{
        href: config.protocol+'://'+config.host+'/storage/'+userName,
        rel: "remoteStorage",
        type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
        properties: {
          'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
          'auth-endpoint': config.protocol+'://'+config.host+'/auth/'+userName
        }
      }]
    });
  }
  function oauth(urlObj, res) {
    console.log('OAUTH');
    var scopes = decodeURIComponent(urlObj.query['scope']).split(' '),
      clientId = decodeURIComponent(urlObj.query['client_id']),
      redirectUri = decodeURIComponent(urlObj.query['redirect_uri']),
      clientIdToMatch,
      userName;
    if(redirectUri.split('://').length<2) {
      clientIdToMatch=redirectUri;
    } else {
      clientIdToMatch = redirectUri.split('://')[1].split('/')[0];
    }
    if(clientId != clientIdToMatch) {
      writeHtml(res, 'we do not trust this combination of client_id and redirect_uri');
    } else {
      var userName = urlObj.pathname.substring('/auth'.length);
      createToken(userName, scopes, function(token) {
        writeHtml(res, '<a href="'+toHtml(redirectUri)+'#access_token='+toHtml(token)+'">Allow</a>');
      });
    }
  }
  function storage(req, urlObj, res) {
    var path=urlObj.pathname.substring('/storage/'.length);
    if(req.method=='OPTIONS') {
      console.log('OPTIONS ', req.headers);
      writeJson(res, null, req.headers.origin);
    } else if(req.method=='GET') {
      console.log('GET');
      if(mayRead(req.headers.authorization, path)) {
        if(content[path]) {
          if(path.substr(-1)=='/') {
            writeJson(res, content[path], req.headers.origin, 0);
          } else {
            writeRaw(res, contentType[path], content[path], req.headers.origin, lastModified[path]);
          }
        } else {
          if(path.substr(-1)=='/') {
            writeJson(res, {}, req.headers.origin, 0);
          } else {
            give404(res, req.headers.origin);
          }
        }
      } else {
        computerSaysNo(res, req.headers.origin);
      }
    } else if(req.method=='PUT') {
      console.log('PUT');
      if(mayWrite(req.headers.authorization, path) && path.substr(-1)!='/') {
        var dataStr = '';
        req.on('data', function(chunk) {
          dataStr+=chunk;
        });
        req.on('end', function(chunk) {
          var timestamp = new Date().getTime();
          content[path]=dataStr;
          contentType[path]=req.headers['content-type'];
          console.log('stored '+path, content[path], contentType[path]);
          lastModified[path]=timestamp;
          var pathParts=path.split('/');
          var timestamp=new Date().getTime();
          console.log(pathParts);
          var fileItself=true;
          while(pathParts.length > 2) {
            var thisPart = pathParts.pop();
            if(fileItself) {
              fileItself=false;
            } else {
              thisPart += '/';
            }
            if(!content[pathParts.join('/')+'/']) {
              content[pathParts.join('/')+'/'] = {};
            }
            content[pathParts.join('/')+'/'][thisPart]=timestamp;
            console.log('stored parent '+pathParts.join('/')+'/ ['+thisPart+']='+timestamp, content[pathParts.join('/')+'/']);
          }
          console.log('content:', content);
          console.log('contentType:', contentType);
          console.log('lastModified:', lastModified);
          writeJson(res, null, req.headers.origin, timestamp);
        });
      } else {
        computerSaysNo(res, req.headers.origin);
      }
    } else if(req.method=='DELETE') {
      console.log('DELETE');
      if(mayWrite(req.headers.authorization, path)) {
          var timestamp = new Date().getTime();
          delete content[path];
          delete contentType[path];
          lastModified[path]=timestamp;
          var pathParts=path.split('/');
          var thisPart = pathParts.pop();
          if(content[pathParts.join('/')+'/']) {
            console.log('delete content['+pathParts.join('/')+'/]['+thisPart+']');
            delete content[pathParts.join('/')+'/'][thisPart];
          }
          console.log(content);
          writeJson(res, null, req.headers.origin, timestamp);
      } else {
        computerSaysNo(res, req.headers.origin);
      }
    } else {
      console.log('ILLEGAL '+req.method);
      computerSaysNo(res, req.headers.origin);
    }
  }
  function serve(req, res, staticsMap) {
    var urlObj = url.parse(req.url, true), userAddress, userName;
    console.log(urlObj);
    if(urlObj.pathname == '/') {
      console.log('PORTAL');
      portal(urlObj, res);
    } else if(urlObj.pathname == '/.well-known/host-meta.json') {//TODO: implement rest of webfinger
      console.log('HOST-META');
      webfinger(urlObj, res);
    } else if(urlObj.pathname.substring(0, '/auth/'.length) == '/auth/') {
      console.log('OAUTH');
      oauth(urlObj, res);
    } else if(urlObj.pathname.substring(0, '/storage/'.length) == '/storage/') {
      console.log('STORAGE');
      storage(req, urlObj, res);
    } else {
      console.log('UNKNOWN');
      writeJson(res, urlObj.query);
    }
  }

  return {
    serve: serve
  };
})();

if(require.main==module) {//if this file is directly called from the CLI
  require('http').createServer(exports.handler.serve).listen(config.port);
}

