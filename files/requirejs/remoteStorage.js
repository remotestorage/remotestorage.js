(function() {
  var modules = [
    'ajax',

    'webfinger',
    'oauth',
    'session',

    'couch',

    'sync',
    'versioning',

    'controller',
    'button'
  ];
  var config = {
    jsFileName: 'remoteStorage.js',
    modulesFilePath: 'http://unhosted.nodejitsu.com/'
  };
  require(modules, function() {
    console.log('all systems are go');
  });
})();
