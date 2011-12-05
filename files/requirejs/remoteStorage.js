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
  require(modules, function(main, ajax, webfinger, oauth, session, couch, sync, versioning, controller, button) {
    var exports = {
      main: main,
      ajax: ajax.ajax,
      webfinger: webfinger.webfinger,
      oauth: oauth.oauth,
      session: session.session,
      couch: couch.couch,
      sync: sync.sync,
      versioning: versioning.versioning,
      controller: controller.controller,
      button: button.button
    };
    main.go(exports);
  });
})();
