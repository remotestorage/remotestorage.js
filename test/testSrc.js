require(['../src/remoteStorage'], function(remoteStorage) {
  var tests = {
    'admin@mich.oc': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav',
      href: 'http://mich.oc/apps/remoteStorage/WebDAV.php/admin/remoteStorage',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'http://mich.oc/?app=remoteStorage&getfile=auth.php&userid=admin'
      }
    },
    'michiel@5apps.com': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple',
      href: 'https://5apps.com/storage/michiel',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'https://5apps.com/oauth/michiel'
      }
    },
    'francois@surfnet.nl': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple',
      href: 'https://storage.surfnetlabs.nl/francois@surfnet.nl',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'https://storage.surfnetlabs.nl/oauth/authorize?user_address=francois@surfnet.nl'
      }
    },
    'michiel@owncube.com': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav',
      href: 'https://owncube.com/apps/remoteStorage/WebDAV.php/michiel/remoteStorage',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'https://owncube.com/apps/remoteStorage/auth.php/michiel'
      }
    },
    'dejong.michiel@iriscouch.com': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb',
      href: 'http://proxy.unhosted.org/CouchDb/iriscouch.com/dejong.michiel',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com'
      }
    },
    'dejong.michiel@gmail.com': {
      type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb',
      href: 'http://proxy.unhosted.org/CouchDb/iriscouch.com/dejong.michiel',
      properties: {
        'http://oauth.net/core/1.0/endpoint/request': 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com'
      }
    },
    'admin@michi.oc': {
      type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#webdav',
      href: 'http://michi.oc/apps/remoteStorage/WebDAV.php/admin/remoteStorage',
      properties: {
        'auth-endpoint': 'http://michi.oc/?app=remoteStorage&getfile=auth.php&userid=admin'
      }
    }
  };
  function check(i) {
    remoteStorage.getStorageInfo(i, function(err, storageInfo){
      console.log(storageInfo);
      if(!storageInfo) {
        document.write(i+' ERR ('+JSON.stringify(storageInfo)+')<br>');
      } else if (storageInfo.type != tests[i].type) {
        document.write(i+' ERR (type: '+JSON.stringify(storageInfo.type)+')<br>');
      } else if (storageInfo.properties['http://oauth.net/core/1.0/endpoint/request'] 
                 != tests[i].properties['http://oauth.net/core/1.0/endpoint/request']) {
        document.write(i+' ERR (authorize end-point: '+JSON.stringify(storageInfo.auth.href)+')<br>');
      } else if (storageInfo.href != tests[i].href) {
        document.write(i+' ERR (href: '+JSON.stringify(storageInfo.href)+')<br>');
      } else {
        document.write(i+' OK<br>');
      }
    });
  }
  for(test in tests) {
    check(test);
  }
  if(true) {
    remoteStorage.getStorageInfo('michiel@owncube.com', function(err, storageInfo) {
      var response = remoteStorage.createOAuthAddress(storageInfo, ['a:rw'], 'http://localhost/asdf.html');
      if(response == 'https://owncube.com/apps/remoteStorage/auth.php/michiel?redirect_uri=http%3A%2F%2Flocalhost%2Fasdf.html&scope='
          +encodeURIComponent('a')+'&response_type=token&client_id=http%3A%2F%2Flocalhost%2Fasdf.html') {
        document.write('Legacy OAuth OK<br>');
      } else {
        document.write('Legacy OAuth ERR:'+response+'<br>');
      }
    });
  }
});
