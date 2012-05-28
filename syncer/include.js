//remoteStorage.js:

(function(){function c(c,d,e){a[c]=e;var f=c.substring(0,c.lastIndexOf("/")+1);b[c]=[];for(var g=0;g<d.length;g++)d[g].substring(0,2)=="./"&&(d[g]=d[g].substring(2)),b[c].push(f+d[g])}function d(c){if(c=="require")return function(){};var e=b[c],f={};for(var g=0;g<e.length;g++)f[e[g]]=d(e[g]);var h=[];for(var g=0;g<e.length;g++)h.push(f[e[g]]);return a[c].apply({},h)}var a={},b={};c("lib/platform",[],function(){function a(a){var b=!1,c;a.timeout&&(c=window.setTimeout(function(){b=!0,a.error("timeout")},a.timeout));var d=new XMLHttpRequest;a.method||(a.method="GET"),d.open(a.method,a.url,!0);if(a.headers)for(var e in a.headers)d.setRequestHeader(e,a.headers[e]);d.onreadystatechange=function(){d.readyState==4&&!b&&(c&&window.clearTimeout(c),d.status==200||d.status==201||d.status==204?a.success(d.responseText):a.error(d.status))},typeof a.data=="string"?d.send(a.data):d.send()}function b(a){var b=new XDomainRequest;b.timeout=a.timeout||3e3,b.open(a.method,a.url),b.onload=function(){b.status==200||b.status==201||b.status==204?a.success(xhr.responseText):a.error(xhr.status)},b.onerror=function(){err("unknown error")},b.ontimeout=function(){err(timeout)},a.data?b.send(a.data):b.send()}function c(a){var b=require("http"),c=require("https"),d=require("url");a.method||(a.method="GET"),a.data||(a.data=null);var e=d.parse(a.url),f={method:a.method,host:e.hostname,path:e.path,port:e.port?port:e.protocol=="https:"?443:80,headers:a.headers},g,h,i=e.protocol=="https:"?c:b,j=i.request(f,function(b){var c="";b.setEncoding("utf8"),b.on("data",function(a){c+=a}),b.on("end",function(){g&&clearTimeout(g),h||(b.statusCode==200||b.statusCode==201||b.statusCode==204?a.success(c):a.error(b.statusCode))})});j.on("error",function(b){a.error(b.message)}),a.timeout&&(g=setTimeout(function(){a.error("timeout"),h=!0},a.timeout)),a.data?j.end(a.data):j.end()}function d(a,b){var c=(new DOMParser).parseFromString(a,"text/xml"),d=c.getElementsByTagName("Link"),e={Link:[]};for(var f=0;f<d.length;f++){var g={};for(var h=0;h<d[f].attributes.length;h++)g[d[f].attributes[h].name]=d[f].attributes[h].value;g.rel&&e.Link.push({"@":g})}b(null,e)}function e(a,b){var c=require("xml2js");(new c.Parser).parseString(a,b)}return typeof window=="undefined"?{ajax:c,parseXml:e}:window.XDomainRequest?{ajax:b,parseXml:d}:{ajax:a,parseXml:d}}),c("lib/couch",["./platform"],function(a){function c(a){if(!b){try{b=JSON.parse(localStorage.getItem("_shadowCouchRev"))}catch(c){}b||(b={})}return b[a]}function d(a,c){if(!b)try{b=JSON.parse(localStorage.getItem("_shadowCouchRev"))}catch(d){}b||(b={}),b[a]=c,localStorage.setItem("_shadowCouchRev",JSON.stringify(b))}function e(b,c,d,e,f){var g={url:c,method:b,error:function(a){a==404?f(null,undefined):f(a,null)},success:function(a){f(null,a)},timeout:3e3};e&&(g.headers={Authorization:"Bearer "+e}),g.fields={withCredentials:"true"},b!="GET"&&(g.data=d),a.ajax(g)}function f(a,b,c){e("GET",a,null,b,function(b,e){if(b)c(b,e);else{var f;try{f=JSON.parse(e)}catch(g){}f&&f._rev?(d(a,f._rev),c(null,f.value)):typeof e=="undefined"?c(null,undefined):c("unparsable data from couch")}})}function g(a,b,f,g){var h=c(a),i={value:b};h&&(i._rev=h),e("PUT",a,JSON.stringify(i),f,function(c,h){if(c)c==409?e("GET",a,null,f,function(c,h){if(c)g("after 409, got a "+c);else{var j;try{j=JSON.parse(h)._rev}catch(k){}j?(i={value:b,_rev:j},d(a,j),e("PUT",a,JSON.stringify(i),f,function(a,b){a?g("after 409, second attempt got "+a):g(null)})):g("after 409, got unparseable JSON")}}):g(c);else{var i;try{i=JSON.parse(h)}catch(j){}i&&i.rev&&d(a,i.rev),g(null)}})}function h(a,b,f){var g=c(a);e("DELETE",a+(g?"?rev="+g:""),null,b,function(c,g){c==409?e("GET",a,null,b,function(c,g){if(c)f("after 409, got a "+c);else{var h;try{h=JSON.parse(g)._rev}catch(i){}h?(d(a,h),e("DELETE",a+"?rev="+h,null,b,function(b,c){b?f("after 409, second attempt got "+b):(d(a,undefined),f(null))})):f("after 409, got unparseable JSON")}}):(c||d(a,undefined),f(c))})}var b=null;return{get:f,put:g,"delete":h}}),c("lib/dav",["./platform"],function(a){function b(b,c,d,e,f,g){var h={url:c,method:b,error:function(a){a==404?f(null,undefined):f(a,null)},success:function(a){f(null,a)},timeout:3e3};h.headers={Authorization:"Bearer "+e,"Content-Type":"text/plain;charset=UTF-8"},h.fields={withCredentials:"true"},b!="GET"&&(h.data=d),a.ajax(h)}function c(a,c,d){b("GET",a,null,c,d)}function d(a,c,d,e){b("PUT",a,c,d,e)}function e(a,c,d){b("DELETE",a,null,c,d)}return{get:c,put:d,"delete":e}}),c("lib/webfinger",["./platform"],function(a){function b(a,b){var c=a.toLowerCase().split("@");c.length<2?b("That is not a user address. There is no @-sign in it"):c.length>2?b("That is not a user address. There is more than one @-sign in it"):/^[\.0-9a-z\-\_]+$/.test(c[0])?/^[\.0-9a-z\-]+$/.test(c[1])?b(null,["https://"+c[1]+"/.well-known/host-meta","http://"+c[1]+"/.well-known/host-meta"]):b('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+c[1]+'"'):b('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+c[0]+'"')}function c(b,f,g){var h=b.shift();h?a.ajax({url:h,success:function(a){e(a,function(e,h){e?d(a,function(a,d){a?c(b,f,g):g(null,d)}):g(null,h)})},error:function(a){c(b,f,g)},timeout:f}):g("could not fetch xrd")}function d(b,c){a.parseXml(b,function(a,b){if(a)c(a);else if(b&&b.Link){var d={};if(b.Link&&b.Link["@"])b.Link["@"].rel&&(d[b.Link["@"].rel]=b.Link["@"]);else for(var e=0;e<b.Link.length;e++)b.Link[e]["@"]&&b.Link[e]["@"].rel&&(d[b.Link[e]["@"].rel]=b.Link[e]["@"]);c(null,d)}else c("found valid xml but with no Link elements in there")})}function e(a,b){var c;try{c=JSON.parse(a)}catch(d){b("not valid JSON");return}var e={};for(var f=0;f<c.links.length;f++)c.links[f].rel&&(e[c.links[f].rel]=c.links[f]);b(null,e)}function f(a,d,e){b(a,function(b,f){b?e(err):c(f,d.timeout,function(b,f){if(b)e("could not fetch host-meta for "+a);else if(f.lrdd&&f.lrdd.template){var g=f.lrdd.template.split("{uri}"),h=[g.join("acct:"+a),g.join(a)];c(h,d.timeout,function(b,c){if(b)e("could not fetch lrdd for "+a);else if(c.remoteStorage&&c.remoteStorage.auth&&c.remoteStorage.api&&c.remoteStorage.template){var d={};if(c["remoteStorage"]["api"]=="simple")d.type="https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple";else if(c["remoteStorage"]["api"]=="WebDAV")d.type="https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav";else if(c["remoteStorage"]["api"]=="CouchDB")d.type="https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb";else{e("api not recognized");return}var f=c.remoteStorage.template.split("{category}");f[0].substring(f[0].length-1)=="/"?d.href=f[0].substring(0,f[0].length-1):d.href=f[0],f.length==2&&f[1]!="/"&&(d.legacySuffix=f[1]),d.properties={"access-methods":["http://oauth.net/core/1.0/parameters/auth-header"],"auth-methods":["http://oauth.net/discovery/1.0/consumer-identity/static"],"http://oauth.net/core/1.0/endpoint/request":c.remoteStorage.auth},e(null,d)}else c.remotestorage&&c.remotestorage.href&&c.remotestorage.type&&c.remotestorage.properties&&c.remotestorage.properties["http://oauth.net/core/1.0/endpoint/request"]?e(null,c.remotestorage):e("could not extract storageInfo from lrdd")})}else e("could not extract lrdd template from host-meta")})})}return{getStorageInfo:f}}),c("lib/hardcoded",["./platform"],function(a){function c(b,c,d){a.ajax({url:"http://proxy.unhosted.org/irisCouchCheck?q=acct:"+b,success:function(a){var b;try{b=JSON.parse(a)}catch(c){}b?d(null,b):d("err: unparsable response from IrisCouch check")},error:function(a){d("err: during IrisCouch test:"+a)},timeout:c.timeout})}function d(a){var b=a.split("@");return["libredocs","mail","browserid","me"].indexOf(b[0])==-1?b[0]+"@iriscouch.com":b[2].substring(0,b[2].indexOf("."))+"@iriscouch.com"}function e(a,d,e){var f=a.split("@");if(f.length<2)e("That is not a user address. There is no @-sign in it");else if(f.length>2)e("That is not a user address. There is more than one @-sign in it");else if(!/^[\.0-9A-Za-z]+$/.test(f[0]))e('That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+f[0]+'"');else if(!/^[\.0-9A-Za-z\-]+$/.test(f[1]))e('That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+f[1]+'"');else{while(f[1].indexOf(".")!=-1){if(b[f[1]]){blueprint=b[f[1]],e(null,{rel:"https://www.w3.org/community/unhosted/wiki/personal-data-service-00",type:blueprint.type,href:blueprint.hrefPrefix+"/"+(blueprint.pathFormat=="user@host"?a:f[1]+"/"+f[0]),properties:{"access-methods":["http://oauth.net/core/1.0/parameters/auth-header"],"auth-methods":["http://oauth.net/discovery/1.0/consumer-identity/static"],"http://oauth.net/core/1.0/endpoint/request":blueprint.authPrefix+a}});return}f[1]=f[1].substring(f[1].indexOf(".")+1)}new Date<new Date("9/9/2012")?c(a,d,e):e("err: not a guessable domain, and fakefinger-migration has ended")}}var b={"iriscouch.com":{type:"https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb",authPrefix:"http://proxy.unhosted.org/OAuth.html?userAddress=",hrefPrefix:"http://proxy.unhosted.org/CouchDb",pathFormat:"host/user"}};return function(){var a={type:"https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple",authPrefix:"https://storage.surfnetlabs.nl/saml/oauth/authorize?user_address=",hrefPrefix:"https://storage.surfnetlabs.nl/saml",pathFormat:"user@host"},c={type:"https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple",authPrefix:"https://storage.surfnetlabs.nl/browserid/oauth/authorize?user_address=",hrefPrefix:"https://storage.surfnetlabs.nl/browserid",pathFormat:"user@host"},d=["leidenuniv.nl","leiden.edu","uva.nl","vu.nl","eur.nl","maastrichtuniversity.nl","ru.nl","rug.nl","uu.nl","tudelft.nl","utwente.nl","tue.nl","tilburguniversity.edu","uvt.n","wur.nl","wageningenuniversity.nl","ou.nl","lumc.nl","amc.nl","tuxed.net"],e=["surfnet.nl"];for(var f=0;f<e.length;f++)b[e[f]]=a;for(var f=0;f<d.length;f++)b[d[f]]=c}(),{guessStorageInfo:e}}),c("remoteStorage",["require","./lib/platform","./lib/couch","./lib/dav","./lib/webfinger","./lib/hardcoded"],function(a,b,c,d,e,f){var g=function(a,b){typeof a!="string"?b("user address should be a string"):e.getStorageInfo(a,{timeout:3e3},function(c,d){c?f.guessStorageInfo(a,{timeout:3e3},function(a,c){b(a,c)}):(d.rel=d.type,b(c,d))})},h=function(a,b,c){if(a.type=="https://www.w3.org/community/rww/wiki/read-write-web-00#simple")scopesStr=b.join(" ");else{var d=[];for(var e=0;e<b.length;e++)d.push(b[e].split(":")[0].split("/")[0]);scopesStr=d.join(",")}var f=["redirect_uri="+encodeURIComponent(c),"scope="+encodeURIComponent(scopesStr),"response_type=token","client_id="+encodeURIComponent(c)],g=a.properties["http://oauth.net/core/1.0/endpoint/request"];return g+(g.indexOf("?")===-1?"?":"&")+f.join("&")},i=function(a,b){b(a==="pds-remotestorage-00#couchdb"?c:d)},j=function(a,b,c){var d=((b.length?b+"/":"")+c).split("/"),e=d.splice(1).join("_");return a.href+"/"+d[0]+(a.legacySuffix?a.legacySuffix:"")+"/"+(e[0]=="_"?"u":"")+e},k=function(a,b,c){return{get:function(d,e){typeof d!="string"?e('argument "key" should be a string'):i(a.type,function(f){f.get(j(a,b,d),c,e)})},put:function(d,e,f){typeof d!="string"?f('argument "key" should be a string'):typeof e!="string"?f('argument "value" should be a string'):i(a.type,function(g){g.put(j(a,b,d),e,c,f)})},"delete":function(d,e){typeof d!="string"?e('argument "key" should be a string'):i(a.type,function(f){f["delete"](j(a,b,d),c,e)})}}},l=function(){var a,b;if(location.hash.length>0){a=location.hash.split("&");for(var c=0;c<a.length;c++){a[c][0]=="#"&&(a[c]=a[c].substring(1));if(a[c].substring(0,"access_token=".length)=="access_token=")return a[c].substring("access_token=".length)}}return null};return{getStorageInfo:g,createOAuthAddress:h,createClient:k,receiveToken:l}}),remoteStorage=d("remoteStorage")})()//remoteStorage.js:



  //sync.js itself:

  syncer = (function() {
    var indexCache = {};
    var indexKey;
    var readyState={};
    orsc=function(obj){console.log('ready state changed to:');console.log(obj);};
    oc=function(obj){console.log('incoming changeset:');console.log(obj);};
    ol=function(str){
      console.log(str);
    }
    function inspect() { 
      var inspectorgadget = document.getElementById('inspector-gadget');
      if(!inspectorgadget) {
        inspectorgadget = document.createElement('div');
        inspectorgadget.setAttribute('id', 'inspector-gadget');
        inspectorgadget.innerHTML = '<h1 style="font:bold 16px/32px sans-serif;">Inspector Gadget</h1><div id="inspector-log"></div>';
        inspectorgadget.setAttribute('style','position:fixed; display:block; bottom:0; left:0; padding:1em; background:#000; color:#ddd; opacity:.5; font:12px/20px monospace; z-index:99999; width:100%; max-height:200px; overflow:auto;');
        document.body.appendChild(inspectorgadget);
         ol = function(str) {
          document.getElementById('inspector-log').innerHTML = '<p>' + str + '</p>' + document.getElementById('inspector-log').innerHTML;
        };
      }
    }
    function changeReadyState(field, value) {
      readyState[field]=value;
      orsc(readyState);
    }
    //localStorage keys used by this lib:
    //_unhosted$userAddress
    //_unhosted$categories
    //_unhosted$storageInfo
    //_unhosted$bearerToken
    
    //_unhosted$pullInterval
    
    //_unhosted$lastPushStartTime
    //_unhosted$lastPullStartTime
    
    //_unhosted$lastPushEndTime
    //_unhosted$lastPullEndTime
   
    //for each [category]:
    //_unhosted$index:[category]

    function connect(userAddress, categories, pullInterval, dialogPath) {
      if(!typeof(userAddress) == 'string') {
        return false;
      }
      var parts = userAddress.split('@');
      if(parts.length != 2) {
        return false;
      }
      if(parts[1].split('.').length < 2) {
        return false;
      }
      ol('syncer.connect('
        +JSON.stringify(userAddress)+', '
        +JSON.stringify(categories)+', '
        +JSON.stringify(pullInterval)+', '
        +JSON.stringify(dialogPath)+');');
      if(localStorage['_unhosted$bearerToken']) {
        console.log('err: already connected');
        return;
      }
      if(typeof(dialogPath) === 'undefined') {
        dialogPath = 'syncer/dialog.html';
      }
      if(typeof(pullInterval) === 'undefined') {
        pullInterval = 60;
      }
      localStorage['_unhosted$userAddress'] = userAddress;
      localStorage['_unhosted$categories'] = JSON.stringify(categories);
      localStorage['_unhosted$pullInterval'] = pullInterval;
      window.open(dialogPath);
      window.addEventListener('storage', function(event) {
        if(event.key=='_unhosted$bearerToken' && event.newValue) {
          if(pullInterval) {
            setInterval(work, pullInterval*1000);//will first trigger a pull if it's time for that
          }
          changeReadyState('connected', true);
        }
        if(event.key=='_unhosted$dialogResult' && event.newValue) {
          try {
            console.log(JSON.parse(event.newValue));
          } catch(e) {
            console.log('unparseable dialog result');
          }
        }
      }, false);
      return true;
    }
    function parseObj(str) {
      var obj;
      try {
        obj = JSON.parse(str);
      } catch(e) {
      }
      if(obj) {//so str is parseable /and/ the result is not falsy
        return obj;
      } else {
        return {};
      }
    }
    function iterate(obj, itemCb, finishedCb, lastItem) {//helper function to async over an object's keys.
      if(typeof(obj) == 'object') {
        for(var thisItem in obj) {
          if(!lastItem) {
            itemCb(thisItem, function() {
              iterate(obj, itemCb, finishedCb, thisItem);
            });
            return;//execution will continue in the callback of itemCb
          } else if(thisItem == lastItem) {
            lastItem = undefined;//go execute on next one
          }
        }
      }
      finishedCb();
    }
    function pullIn(localIndex, remoteIndex, client, cb) {//iterates over remoteIndex, pulling where necessary
      iterate(remoteIndex, function(item, doneCb) {
        if(!localIndex[item] || localIndex[item] < remoteIndex[item]) {
          client.get(item+':'+remoteIndex[item], function(err, data) {
            if(!err) {
              var oldValue = localStorage[client.category+'$'+item];
              localIndex[item]=remoteIndex[item]
              localStorage[client.category+'$_index']=JSON.stringify(localIndex);
              localStorage[client.category+'$'+item]=data;
              oc({
                category: client.category,
                key: item,
                oldValue: oldValue,
                newValue: data,
                timestamp: remoteIndex[item]
              });
              ol(client.category+'$'+item+' <- '+data);
            }
            doneCb();
          });
        } else {
          doneCb();
        }
      }, cb);
    }
    function pushOut(localIndex, remoteIndex, client, cb) {//iterates over localIndex, pushing where necessary
      var havePushed=false;
      iterate(localIndex, function(item, doneCb) {
        if(!remoteIndex[item] || remoteIndex[item] < localIndex[item]) {
          client.put(item+':'+localIndex[item], localStorage[client.category+'$'+item], function(err) {
            if(err) {
              console.log('error pushing: '+err);
            } else {//success reported, so set remoteIndex timestamp to ours
              ol(client.category+'$'+item+' -> '+localStorage[client.category+'$'+item]);
              remoteIndex[item]=localIndex[item];
              havePushed=true;
            }
            doneCb();
          });
        } else {
          doneCb();
        }
      }, function() {
        if(havePushed) {
          client.put('_index', JSON.stringify(remoteIndex), function(err) {
            if(err) {
              console.log('error pushing index: '+err);
            }
            cb();
          });
        } else {
          cb();
        }
      });
    }
    function pullCategory(storageInfo, category, bearerToken, cb) {//calls pullIn, then pushOut for a category
      var client=remoteStorage.createClient(storageInfo, category, bearerToken);
      client.category = category;
      client.get('_index', function(err, data) {
        if(!err) {
          var remoteIndex=parseObj(data);
          var localIndex = parseObj(localStorage[category+'$_index']);
          pullIn(localIndex, remoteIndex, client, function() {
            pushOut(localIndex, remoteIndex, client, cb);
          });
        }
      });
    }
    function pullCategories(storageInfo, categories, bearerToken, cb) {//calls pullCategory once for every category
      if(categories.length) {
        var thisCat=categories.shift();
        pullCategory(storageInfo, thisCat, bearerToken, function() {
          pullCategories(storageInfo, categories, bearerToken, cb);
        });
      } else {
        cb();
      }
    }
    function pull(cb) {//gathers settings and calls pullCategories
      var categories, storageInfo, bearerToken;
      try {
        categories=JSON.parse(localStorage['_unhosted$categories']);
        storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
        bearerToken=localStorage['_unhosted$bearerToken'];
      } catch(e) {
      }
      if(categories && storageInfo && bearerToken) {
        pullCategories(storageInfo, categories, bearerToken, cb);
      }
    }
    function maybePull(now, cb) {
      if(localStorage['_unhosted$bearerToken'] && localStorage['_unhosted$pullInterval']) {
        if(!localStorage['_unhosted$lastPullStartTime'] //never pulled yet
          || parseInt(localStorage['_unhosted$lastPullStartTime']) + localStorage['_unhosted$pullInterval']*1000 < now) {//time to pull
          localStorage['_unhosted$lastPullStartTime']=now;
          changeReadyState('syncing', true);
          pull(function() {
            changeReadyState('syncing', false);
            cb();
          });
        } else {
          changeReadyState('syncing', false);
          cb();
        }
      } else {
        changeReadyState('syncing', false);
        cb();
      }
    }
    function pushItem(category, key, timestamp, indexStr, valueStr, cb) {
      console.log('push '+category+'$'+key+': '+valueStr);
      if(category != '_unhosted') {
        var storageInfo, bearerToken;
        try {
          storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
          bearerToken=localStorage['_unhosted$bearerToken'];
        } catch(e) {
        }
        if(storageInfo && bearerToken) {
          var client = remoteStorage.createClient(storageInfo, category, bearerToken);
          client.put('_index', indexStr, function(err, data) {
            client.put(key+':'+timestamp, valueStr, function(err, data) {
            });
          });
        }
      }
      if(cb) {
        cb();//not really finished here yet actually
      }
    }
    function onLoad() {
      if(localStorage['_unhosted$pullInterval']) {
        delete localStorage['_unhosted$lastPullStartTime'];
        work();
        setInterval(work, localStorage['_unhosted$pullInterval']*1000);
      }
    }
    function work() {
      var now = new Date().getTime();
      maybePull(now, function() {
      });
    }
    function onReadyStateChange(cb) {
      orsc=cb;
      changeReadyState('connected', (localStorage['_unhosted$bearerToken'] != null));
    }
    function onChange(cb) {
      oc=cb;
    }
    function getUserAddress() {
      return localStorage['_unhosted$userAddress'];
    }
    function getItem(category, key) {
      ol('syncer.getItem('
        +JSON.stringify(category)+', '
        +JSON.stringify(key)+');');
      try {
        return JSON.parse(localStorage[category+'$'+key]);
      } catch(e) {
        return null;
      }
    }
    function setItem(category, key, value) {
      ol('syncer.setItem('
        +JSON.stringify(category)+', '
        +JSON.stringify(key)+', '
        +JSON.stringify(value)+');');
      var valueStr = JSON.stringify(value);
      if(key=='_index') {
        return 'item key "_index" is reserved, pick another one please';
      } else {
        var currValStr = localStorage[category+'$'+key];
        if(valueStr != currValStr) {
          var now = new Date().getTime();
          var index;
          try {
            index=JSON.parse(localStorage[category+'$_index']);
          } catch(e) {
          }
          if(!index) {
            index={};
          }
          index[key]=now;
          var indexStr=JSON.stringify(index);
          localStorage[category+'$_index']=indexStr;
          localStorage[category+'$'+key]=valueStr;
          pushItem(category, key, now, indexStr, valueStr);
          oc({key: key, oldValue: getItem(category, key), newValue: value});
        }
      }
    }
    function removeItem(category, key) {
      ol('syncer.removeItem('
        +JSON.stringify(category)+', '
        +JSON.stringify(key)+');');
      if(key=='_index') {
        return 'item key "_index" is reserved, pick another one please';
      } else {
        var index;
        try {
          index=JSON.parse(localStorage[category+'$_index']);
        } catch(e) {
        }
        if(index) {
          delete index[key];
          var indexStr=JSON.stringify(index);
          localStorage[category+'$_index']=indexStr;
          delete localStorage[category+'$'+key];
          var now = new Date().getTime();
          pushItem(category, key, now, indexStr, null);
          oc({key: key, oldValue: getItem(category, key), newValue: undefined});
        }
      }
    } 
    function getCollection(category) {
      ol('syncer.getCollection('
        +JSON.stringify(category)+');');
      var index;
      try {
        index=JSON.parse(localStorage[category+'$_index']);
      } catch(e) {
      }
      if(index) {
        var items = [];
        for(var i in index) {
          try {
            items.push(JSON.parse(localStorage[category+'$'+i]));
          } catch(e) {
          }
        }
        return items;
      } else {
        return [];
      }
    }
    function display(connectElement, categories, libDir, onChangeHandler) {
      if(libDir.length && libDir[libDir.length - 1] != '/') {//libDir without trailing slash
        libDir += '/'
      }
      document.getElementById(connectElement).innerHTML =
        '<link href="'+libDir+'remoteStorage.css" rel="stylesheet">'
        +'<input id="remotestorage-useraddress" type="text" placeholder="you@remotestorage" autofocus />'
        +'<input id="remotestorage-status" class="remotestorage-button" type="submit" value="loading &hellip;" disabled />'
        +'<img id="remotestorage-icon" class="remotestorage-loading" src="'+libDir+'remoteStorage-icon.png" />'
        +'<span id="remotestorage-disconnect">Disconnect <strong></strong></span>'
        +'<a id="remotestorage-info" href="http://unhosted.org">?</a>'
        +'<span id="remotestorage-infotext">This app allows you to use your own data storage!<br />Click for more info on the Unhosted movement.</span>'
        +'<a id="remotestorage-get" class="remotestorage-button" href="http://unhosted.org" target="_blank">get remoteStorage</a>';

      document.getElementById('remotestorage-useraddress').onkeyup = function(e) { // connect on enter
        if(e.keyCode==13) document.getElementById('remotestorage-status').click();
      }

      onReadyStateChange(function(obj) {
        if(obj.connected) { // connected state
          document.getElementById('remotestorage-connect').className = 'remotestorage-connected';
          document.getElementById('remotestorage-disconnect').getElementsByTagName('strong')[0].innerHTML = getUserAddress();
          if(obj.syncing) { // spin logo while syncing
            document.getElementById('remotestorage-icon').className = 'remotestorage-loading';
          } else { // do not spin when not syncing
            document.getElementById('remotestorage-icon').className = '';
          }
          document.getElementById('remotestorage-icon').onclick = function() { // when connected, disconnect on logo click
            localStorage.clear();
            onChangeHandler({key: null, oldValue: null, newValue: null});
            changeReadyState('connected', false);
            document.getElementById('remotestorage-connect').className = '';
            document.getElementById('remotestorage-get').style.display = 'inline';
          }
        } else { // disconnected, initial state
          document.getElementById('remotestorage-icon').className = '';
          document.getElementById('remotestorage-useraddress').disabled = true;
          document.getElementById('remotestorage-useraddress').style.display = 'none';
          document.getElementById('remotestorage-status').disabled = false;
          document.getElementById('remotestorage-status').value = 'connect';

          document.getElementById('remotestorage-status').onclick = function() {
            if(document.getElementById('remotestorage-useraddress').disabled == true) { // first click on connect reveals the input
              document.getElementById('remotestorage-get').style.display = 'none';
              document.getElementById('remotestorage-useraddress').style.display = 'inline';
              document.getElementById('remotestorage-useraddress').disabled = false;
              document.getElementById('remotestorage-useraddress').focus();
            } else { // second click on connect starts the connection
              document.getElementById('remotestorage-icon').className = 'remotestorage-loading';
              document.getElementById('remotestorage-useraddress').disabled = true;
              document.getElementById('remotestorage-status').disabled = true;
              document.getElementById('remotestorage-status').value = 'connecting';
              connect(document.getElementById('remotestorage-useraddress').value, categories, 10, libDir+'dialog.html');
            }
          };
        }
      });
      onChange(onChangeHandler);
      //init all data:
      for(var i=0; i < categories.length; i++) {
        var thisColl = getCollection(categories[i]);
        for(var key in thisColl) {
          onChangeHandler({category: categories[i], key: key, newValue: getItem(categories[i], key), oldValue: undefined});
        }
      }
    }
    onLoad();
    return {
      getItem       : getItem,
      getCollection : getCollection,
      setItem       : setItem,
      removeItem    : removeItem,
      display       : display,
      inspect       : inspect
    };
  })();
  //API:
  //
  // - call display(connectElement, categories, libDir, onChangeHandler({key:.., oldValue:.., newValue:..}));
  // - getCollection retrieves the array of items regardless of their id (so it makes sense to store the id inside the item)
  // - CRUD: getItem gets one item. setItem for create and update. removeItem for delete.
  //
  // a note on sync:
  // if just one client connects, then it will feel like localStorage while the user is connected. the only special case there is the moment the user connects.
  // when the page loads for the first time, there will be no data. then the user connects, and your app will receive onChange events. make sure you handle these well.
  // in fact, your app should already have a handler for 'storage' events, because they occur when another tab or window makes a change to localStorage.
  // so you'll be able to reuse that function.
  //
  // if the user tries to leave the page while there is still unsynced data, a 'leave page?' alert will be displayed. disconnecting while offline will lead to loss of data too.
  // but as long as you don't disconnect, it'll all be fine, and sync will resume when the tab is reopened and/or connectivity is re-established.
  //
  // when another device or browser makes a change, it will come in through your onChange handler. it will 'feel' like a change that came from another tab.
  // when another device makes a change while either that device or you, or both are disconnected from the remoteStorage, the change will come in later, and conflict resolution 
  // will be per item, on timestamp basis. note that these are the timestamps generated on the devices, so this only works well if all devices have their clocks in sync.
  // in all cases, you will get an event on your onChange handler for each time data is changed by another device. the event will contain both the old and the new value of the item,
  // so you can always override a change by issuing a setItem command back to the oldValue.
