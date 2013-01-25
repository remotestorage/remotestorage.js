if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['requirejs'], function(requirejs) {

  var suites = [];


  var util;

  suites.push({
    name: "webfinger",
    desc: "tests for webfinger discovery",

    setup: function(env, test) {
      requirejs([
        './src/lib/util',
        './src/lib/platform',
        './src/lib/webfinger'
      ], function(_util, platform, webfinger) {
        util = _util;
        env.webfinger = webfinger;
        env.platform = platform;

        env.originalPlatformAjax = platform.ajax;

        // setup ajax stub
        env.platform.ajax = function(options) {
          var promise = util.getPromise();
          env.ajaxRequests.push({
            options: options,
            promise: promise
          });
          return promise;
        };

        env.findRequest = function(url) {
          var arl = env.ajaxRequests.length;
          for(var i=0;i<arl;i++) {
            if(env.ajaxRequests[i].options.url === url) {
              return env.ajaxRequests[i];
            }
          }
        };

        test.result(true);
      });
    },

    takedown: function(env, test) {
      env.platform.ajax = env.originalPlatformAjax;
      test.result(true);
    },

    beforeEach: function(env, test) {
      env.ajaxRequests = [];
      test.result(true);
    },

    tests: [
      {
        desc: "getStorageInfo does all the right requests",
        run: function(env, test) {
          env.webfinger.getStorageInfo('me@local.dev');
          util.nextTick(function() {
            // FIXME: these should *not* be fired all at the same time, but the less likely ones rather handled as fallbacks.
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'), 'object', 'https webfinger');
            test.assertTypeAnd(env.findRequest('http://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'), 'object', 'http webfinger');
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'), 'object', 'https host-meta');
            test.assertTypeAnd(env.findRequest('http://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'), 'object', 'http host-meta');
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev'), 'object', 'https host-meta.json');
            test.assertType(env.findRequest('http://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev'), 'object', 'http host-meta.json');
          }, 0);
        }
      },

      {
        desc: "getStorageInfo sets the correct default timeout",
        run: function(env, test) {
          env.webfinger.getStorageInfo('you@remote.dev');
          util.nextTick(function() {
            var req = env.findRequest('https://remote.dev/.well-known/webfinger?resource=acct:you%40remote.dev');
            test.assertTypeAnd(req, 'object', 'request not found');
            test.assert(req.options.timeout, 10000);
          });
        }
      },

      {
        desc: "setTimeout changes the default timeout",
        run: function(env, test) {
          env.webfinger.setTimeout(15000);
          test.assert(env.webfinger.getTimeout(), 15000);
        }
      },

      // this test depends on the previous test to have run
      {
        desc: "getStorageInfo uses the timeout set by setTimeout",
        run: function(env, test) {
          env.webfinger.getStorageInfo('you@remote.dev');
          util.nextTick(function() {
            var req = env.findRequest('https://remote.dev/.well-known/webfinger?resource=acct:you%40remote.dev');
            test.assertTypeAnd(req, 'object', 'request not found');
            test.assert(req.options.timeout, 15000);
          });
        }
      }

    ]
    
  });

  return suites;

});
