require(['../src/remoteStorage'], function(remoteStorage) {
  var tests = {
    'michiel@5apps.com': {
      api: 'simple',
      auth: 'https://5apps.com/oauth/michiel',
      template: 'https://5apps.com/storage/michiel/{category}/'
    },
    'michiel@owncube.com': {
      api: 'WebDAV',
      auth: 'https://owncube.com/apps/remoteStorage/auth.php/michiel',
      template: 'https://owncube.com/apps/remoteStorage/WebDAV.php/michiel/remoteStorage/{category}/'
    },
    'dejong.michiel@iriscouch.com': {
      api: 'CouchDB',
      auth: 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com',
      template: 'http://proxy.unhosted.org/IrisCouch/dejong.michiel@iriscouch.com/{category}/'
    },
    'dejong.michiel@gmail.com': {
      api: 'CouchDB',
      auth: 'http://proxy.unhosted.org/OAuth.html?userAddress=dejong.michiel@iriscouch.com',
      template: 'http://proxy.unhosted.org/IrisCouch/dejong.michiel@iriscouch.com/{category}/'
    }
  }
  function check(i) {
    remoteStorage.getStorageInfo(i, function(err, storageInfo){
      console.log(storageInfo);
      if(!storageInfo) {
        document.write(i+' ERR ('+JSON.stringify(storageInfo)+')<br>');
      } else if (storageInfo.api != tests[i].api) {
        document.write(i+' ERR (api: '+JSON.stringify(storageInfo.api)+')<br>');
      } else if (storageInfo.auth != tests[i].auth) {
        document.write(i+' ERR (auth: '+JSON.stringify(storageInfo.auth)+')<br>');
      } else if (storageInfo.template != tests[i].template) {
        document.write(i+' ERR (template: '+JSON.stringify(storageInfo.template)+')<br>');
      } else {
        document.write(i+' OK<br>');
      }
    });
  }
  for(test in tests) {
    check(test);
  }
});
