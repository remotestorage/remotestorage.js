require(['../src/remoteStorage'], function(remoteStorage) {
  var tests = {
    'admin@mich.oc': {
      type: 'pds-remotestorage-00#webdav',
      auth: {
        type: 'pds-oauth2-00',
        href: 'http://mich.oc/?app=remoteStorage&getfile=auth.php&userid=admin'
      },
      href: 'http://mich.oc/apps/remoteStorage/WebDAV.php/admin/remoteStorage'
    },
    'michiel@5apps.com': {
      type: 'pds-remotestorage-00#simple',
      auth: {
        type: 'pds-oauth2-00',
        href: 'https://5apps.com/oauth/michiel'
      },
      href: 'https://5apps.com/storage/michiel'
    },
    'michiel@owncube.com': {
      type: 'pds-remotestorage-00#webdav',
      auth: {
        type: 'pds-oauth2-00',
        href: 'https://owncube.com/apps/remoteStorage/auth.php/michiel'
      },
      href: 'https://owncube.com/apps/remoteStorage/WebDAV.php/michiel/remoteStorage'
    },
    'dejong.michiel@iriscouch.com': {
      type: 'pds-remotestorage-00#couchdb',
      auth: {
        type: 'pds-oauth2-00',
        href: 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com'
      },
      href: 'http://proxy.unhosted.org/IrisCouch/dejong.michiel@iriscouch.com'
    },
    'dejong.michiel@gmail.com': {
      type: 'pds-remotestorage-00#couchdb',
      auth: 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com',
      template: 'http://proxy.unhosted.org/IrisCouch/dejong.michiel@iriscouch.com/{category}/'
    }
  }
  function check(i) {
    remoteStorage.getStorageInfo(i, function(err, storageInfo){
      console.log(storageInfo);
      if(!storageInfo) {
        document.write(i+' ERR ('+JSON.stringify(storageInfo)+')<br>');
      } else if (storageInfo.type != tests[i].type) {
        document.write(i+' ERR (type: '+JSON.stringify(storageInfo.type)+')<br>');
      } else if (storageInfo.auth.href != tests[i].auth.href) {
        document.write(i+' ERR (auth.href: '+JSON.stringify(storageInfo.auth.href)+')<br>');
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
  remoteStorage.getStorageInfo('michiel@owncube.com', function(err, storageInfo) {
    var response = remoteStorage.createOAuthAddress(storageInfo, ['a:rw'], 'http://localhost/asdf.html');
    if(response == 'https://owncube.com/apps/remoteStorage/auth.php/michiel?redirect_uri=http%3A%2F%2Flocalhost%2Fasdf.html&scope='
        +encodeURIComponent('a')+'&response_type=token&client_id=http%3A%2F%2Flocalhost%2Fasdf.html') {
      document.write('Legacy OAuth OK<br>');
    } else {
      document.write('Legacy OAuth ERR:'+response+'<br>');
    }
  });
});
