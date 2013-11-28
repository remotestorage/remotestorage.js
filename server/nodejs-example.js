
var fs = require('fs');

var dontPersist = true;

if(! fs.existsSync) {
  fs.existsSync = function(path) {
    try {
      fs.statSync(path);
      return true;
    } catch(e) {
      return false;
    }
  };
}

var amd = false;
if(typeof(exports) === 'undefined') {
  var exports = {};
  amd = true;
}

var config = {};

exports.server = (function() {
  var url=require('url'),
    crypto=require('crypto'),
    tokens, version, contentType, content;

  var responseDelay = null;
  var capturedRequests = [];
  var doCapture = false;
  var silent = false;

  function log() {
    if(!silent) {
      console.log.apply(console, arguments);
    }
  }

  function captureRequests() {
    doCapture = true;
  }

  function resetState() {
    tokens = {}, version = {}, contentType = {}, content = {};
    responseDelay = null;
    clearCaptured();
    doCapture = false;
  }

  function clearCaptured() {
    while(capturedRequests.length > 0) {
      capturedRequests.shift();
    }
  }

  function getState() {
    return {
      tokens: tokens,
      version: version,
      contentType: contentType,
      content: content
    };
  }

  function delayResponse(msec) {
    responseDelay = msec;
  }

  function saveState(name, value) {
    fs.writeFile("server-state/" + name + ".json", JSON.stringify(value), function() { });
  }

  function loadState(name) {
    if(fs.existsSync("server-state/" + name + ".json")) {
      return JSON.parse(fs.readFileSync("server-state/" + name + ".json"));
    } else {
      return {}
    }
  }

  function saveData() {
    if(dontPersist) {
      return;
    }
    if(! fs.existsSync("server-state")) {
      fs.mkdirSync("server-state");
    }
    saveState('tokens', tokens);
    saveState('version', version);
    saveState('contentType', contentType);
    saveState('content', content);
  }

  function loadData() {
    if(dontPersist) {
      return;
    }
    tokens = loadState('tokens');
    version = loadState('version');
    contentType = loadState('contentType');
    content = loadState('content');

    log("DATA LOADED", tokens, version, contentType, content);
  }


  function makeScopePaths(userName, scopes) {
    var scopePaths=[];
    for(var i=0; i<scopes.length; i++) {
      var thisScopeParts = scopes[i].split(':');
      if(thisScopeParts[0]=='') {
        scopePaths.push(userName+'/:'+thisScopeParts[1]);
      } else {
        scopePaths.push(userName+'/'+thisScopeParts[0]+'/:'+thisScopeParts[1]);
        scopePaths.push(userName+'/public/'+thisScopeParts[0]+'/:'+thisScopeParts[1]);
      }
    }
    return scopePaths;
  }


  function addToken(token, scopes) {
    tokens[token] = makeScopePaths('me', scopes);
  }

  function createInitialTokens() {
    if(! config.initialTokens) {
      return;
    }
    for(var token in config.initialTokens) {
      var scopePaths = makeScopePaths(
        config.defaultUserName, config.initialTokens[token]
      );
      log('adding ',scopePaths,' for', token);
      tokens[token] = scopePaths;
    }
  }

  function createToken(userName, scopes, cb) {
    crypto.randomBytes(48, function(ex, buf) {
      var token = buf.toString('hex');
      var scopePaths = makeScopePaths(userName, scopes);
      log('createToken ',userName,scopes);
      log('adding ',scopePaths,' for',token);
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
            log(path.substring(0, scopeParts[0].length)+' != '+ scopeParts[0]);
          }
        }
      }
    } else {
      var pathParts = path.split('/');
      console.log('pathParts are', pathParts);
      return (pathParts[0]=='me' && pathParts[1]=='public' && path.substr(-1) != '/');
    }
  }
  function mayWrite(authorizationHeader, path) { 
    if(path.substr(-1)=='/') {
      return false;
    }
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
    console.log('writeHead', status, origin, timestamp, contentType);
    var headers = {
      'Access-Control-Allow-Origin': (origin?origin:'*'),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Origin',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE',
    };
    if(typeof(timestamp) != 'undefined') {
      headers['etag']= timestamp.toString();
    }
    if(contentType) {
      headers['content-type']= contentType;
    }
    res.writeHead(status, headers);
  }

  function writeRaw(res, contentType, content, origin, timestamp) {
    function doWrite() {
      log('access-control-allow-origin:'+ (origin?origin:'*'));
      log(contentType);
      log(content);
      writeHead(res, 200, origin, timestamp, contentType);
      res.write(content);
      res.end();
    }
    responseDelay ? setTimeout(doWrite, responseDelay) : doWrite();
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
    log('404');
    log(content);
    writeHead(res, 404, origin);
    res.end();
  }
  function computerSaysNo(res, origin, status, timestamp) {
    log('COMPUTER_SAYS_NO - '+status);
    log(tokens);
    writeHead(res, status, origin, timestamp);
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
      'https://ghost-michiel.5apps.com/': ['pictures:rw'],
      'https://drinks-unhosted.5apps.com/': ['myfavoritedrinks:rw'],
      'https://todomvc.michiel.5apps.com/labs/architecture-examples/remotestorage/': ['tasks:rw'],
    };
    var outstanding = 0;
    for(var i in scopes) {
      outstanding++;
      (function(i) {
        createToken(config.defaultUserName, scopes[i], function(token) {
          res.write('<li><a href="'+i+'#remotestorage=me@local.dev'
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
    log('WEBFINGER');
    if(urlObj.query['resource']) {
      userAddress = urlObj.query['resource'].substring('acct:'.length);
      userName = userAddress.split('@')[0];
    }
    writeJson(res, {
      links:[{
        href: config.protocol+'://'+config.host+':'+config.port+'/storage/'+userName,
        rel: "remotestorage",
        type: "draft-dejong-remotestorage-01",
        properties: {
          'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
          'auth-endpoint': config.protocol+'://'+config.host+':'+config.port+'/auth/'+userName
        }
      }]
    });
  }
  function oauth(urlObj, res) {
    log('OAUTH');
    var scopes = decodeURIComponent(urlObj.query['scope']).split(' '),
    clientId = decodeURIComponent(urlObj.query['client_id']),
    redirectUri = decodeURIComponent(urlObj.query['redirect_uri']),
    clientIdToMatch,
    userName;
    //if(redirectUri.split('://').length<2) {
    //  clientIdToMatch=redirectUri;
    //} else {
    //  clientIdToMatch = redirectUri.split('://')[1].split('/')[0];
    //}
    //if(clientId != clientIdToMatch) {
    //  writeHtml(res, 'we do not trust this combination of client_id and redirect_uri');
    //} else {
      var userName = urlObj.pathname.substring('/auth/'.length);
      createToken(userName, scopes, function(token) {
        writeHtml(res, '<a href="'+toHtml(redirectUri)+'#access_token='+toHtml(token)+'">Allow</a>');
      });
    //}
  }
  function condMet(cond, path) {
    if(cond.ifNoneMatch=='*') {//if-none-match is either '*'...
      if(content[path]) {
        return false;
      }
    } else if(cond.ifNoneMatch && version[path]) {//or a comma-separated list of etags
      if(cond.ifNoneMatch.split(',').indexOf(String(version[path]))!=-1) {
        return false;
      }
    }
    if(cond.ifMatch) {//if-match is always exactly 1 etag
      if(version[path]!=cond.ifMatch) {
        return false;
      }
    }
    return true;
  }
  function storage(req, urlObj, res) {
    var path=urlObj.pathname.substring('/storage/'.length);
    var cond = {
      ifNoneMatch: req.headers['if-none-match'],
      ifMatch: req.headers['if-match']
    };
    var capt = {
      method: req.method,
      path: path
    };

    if(doCapture) {
      capturedRequests.push(capt);
    }

    if(req.method=='OPTIONS') {
      log('OPTIONS ', req.headers);
      writeJson(res, null, req.headers.origin);
    } else if(req.method=='GET') {
      log('GET');
      if(!mayRead(req.headers.authorization, path)) {
        computerSaysNo(res, req.headers.origin, 401);
      } else if(!condMet(cond, path)) {
        computerSaysNo(res, req.headers.origin, 304, version[path]);
      } else {
        if(content[path]) {
          if(path.substr(-1)=='/') {
            writeJson(res, content[path], req.headers.origin, version[path], cond);
          } else {
            writeRaw(res, contentType[path], content[path], req.headers.origin, version[path], cond);
          }
        } else {
          if(path.substr(-1) == '/' && path.split('/').length == 2) {
            writeJson(res, {}, req.headers.origin, 0, cond);
          } else {
            give404(res, req.headers.origin);
          }
        }
      }
    } else if(req.method=='PUT') {
      log('PUT');
      if(path.substr(-1)=='/') {
        computerSaysNo(res, req.headers.origin, 400);
      } else if(!mayWrite(req.headers.authorization, path)) {
        computerSaysNo(res, req.headers.origin, 401);
      } else if(!condMet(cond, path)) {
        computerSaysNo(res, req.headers.origin, 412, version[path]);
      } else {
        var dataStr = '';
        req.on('data', function(chunk) {
          dataStr+=chunk;
        });
        req.on('end', function(chunk) {
          var timestamp = String(new Date().getTime());
          capt.body = dataStr;
          content[path]=dataStr;
          contentType[path]=req.headers['content-type'];
          log('stored '+path, content[path], contentType[path]);
          version[path]=timestamp;
          saveData();
          var pathParts=path.split('/');
          log(pathParts);
          var fileItself=true;
          while(pathParts.length > 1) {
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
            version[pathParts.join('/')+'/'] = timestamp;
            // log('stored parent '+pathParts.join('/')+'/ ['+thisPart+']='+timestamp, content[pathParts.join('/')+'/']);
          }
          // log('content:', content);
          // log('contentType:', contentType);
          // log('version:', version);
          writeJson(res, null, req.headers.origin, timestamp);
        });
      }
    } else if(req.method=='DELETE') {
      log('DELETE');
      if(path.substr(-1)=='/') {
        computerSaysNo(res, req.headers.origin, 400);
      } else if(!mayWrite(req.headers.authorization, path)) {
        computerSaysNo(res, req.headers.origin, 401);
      } else if(!condMet(cond, path)) {
        computerSaysNo(res, req.headers.origin, 412, version[timestamp]);
      } else if(typeof(content[path]) == 'undefined') {
        computerSaysNo(res, req.headers.origin, 404);
      } else {
        var timestamp = version[path]
        delete content[path];
        delete contentType[path];
        delete version[path];
        saveData();
        var pathParts=path.split('/');
        var thisPart = pathParts.pop();
        while(1) {
          var parentPath = pathParts.join('/') + '/';
          var parentListing = content[parentPath];
          log('delete content[' + parentPath + ']['+thisPart+']');
          delete parentListing[thisPart];
          if(Object.keys(parentListing).length != 0 ||
             pathParts.length == 1) {
            version[parentPath] = new Date().getTime();
            break;
          } else {
            delete content[parentPath];
            delete version[parentPath];
            thisPart = pathParts.pop() + '/';
          }
        }
        log(content);
        writeJson(res, null, req.headers.origin, timestamp);
      }
    } else {
      log('ILLEGAL '+req.method);
      computerSaysNo(res, req.headers.origin, 405);
    }
  }

  function serve(req, res) {
    var urlObj = url.parse(req.url, true), userAddress, userName;
    log(urlObj);
    if(urlObj.pathname == '/') {
      log('PORTAL');
      portal(urlObj, res);
    } else if(urlObj.pathname == '/.well-known/host-meta.json') {//TODO: implement rest of webfinger
      log('HOST-META');
      webfinger(urlObj, res);
    } else if(urlObj.pathname.substring(0, '/auth/'.length) == '/auth/') {
      log('OAUTH');
      oauth(urlObj, res);
    } else if(urlObj.pathname.substring(0, '/storage/'.length) == '/storage/') {
      log('STORAGE');
      storage(req, urlObj, res);
    } else if(req.method == 'POST' && urlObj.pathname.substring(0, '/reset'.length) == '/reset') { // clear data; used in tests.
      resetState();
      writeJson(res, { forgot: 'everything' });
    } else {
      log('UNKNOWN');
      res.writeHead(404);
      res.end();
      //writeJson(res, urlObj.query);
    }
  }

  function init() {
    resetState();
    loadData();
    createInitialTokens();
  }

  return {
    init: init,
    serve: serve,
    getState: getState,
    resetState: resetState,
    addToken: addToken,
    delayResponse: delayResponse,
    captureRequests: captureRequests,
    captured: capturedRequests,
    clearCaptured: clearCaptured,
    enableLogs: function() {
      silent = false;
    },
    disableLogs: function() {
      silent = true;
    }
  };
})();

if((!amd) && (require.main==module)) {//if this file is directly called from the CLI
  config = require('./config').config;
  dontPersist = process.argv.length > 1 && (process.argv.slice(-1)[0] == ('--no-persistence'));
  exports.server.init();
  var server;
  if(config.protocol == 'https') {
    var ssl = {};
    for(var k in config.ssl){
      ssl[k] = fs.readFileSync(config.ssl[k])
    }
    server = require('https').createServer(ssl, exports.server.serve);
  } else {
    server = require('http').createServer(exports.server.serve);
  }
  server.listen(config.port, function(){
    console.log("Example server started on 0.0.0.0:" + config.port);
  })
}

if(amd) {
  define([], exports);
}
