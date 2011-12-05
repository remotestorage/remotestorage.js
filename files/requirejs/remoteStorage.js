(function() {
  var modules = [
    'main',
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
  require(modules, function(main) {
    main.go();
  });
})();
