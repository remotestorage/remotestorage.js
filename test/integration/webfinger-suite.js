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
          var index;
          for(var i=0;i<arl;i++) {
            if(env.ajaxRequests[i].options.url === url) {
              index = i;
              break;
            }
          }
          var req = env.ajaxRequests[i];
          delete env.ajaxRequests.splice(i, 1);
          return req;
        };

        env.assertNoRequest = function(test) {
          test.assertAnd(env.ajaxRequests.length, 0, 'expected no more requests, but still have ' + env.ajaxRequests.length);
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
        desc: "getStorageInfo requests HTTPS first",
        run: function(env, test) {
          env.webfinger.getStorageInfo('me@local.dev');
          setTimeout(function() {
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'), 'object', 'https webfinger');
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'), 'object', 'https host-meta');
            test.assertTypeAnd(env.findRequest('https://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev'), 'object', 'https host-meta.json');
            env.assertNoRequest(test);
            test.result(true);
          }, 100);
        }
      },

      {
        desc: "getStorageInfo tries HTTP, if all HTTPS requests fail",
        run: function(env, test) {
          env.webfinger.getStorageInfo('me@local.dev');
          setTimeout(function() {
            var reqs = [
              env.findRequest('https://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev')
            ];
            env.assertNoRequest(test);

            reqs.forEach(function(req) { req.promise.reject(); });

            setTimeout(function() {
              test.assertTypeAnd(env.findRequest('http://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'), 'object', 'http webfinger');
              test.assertTypeAnd(env.findRequest('http://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'), 'object', 'http host-meta');
              test.assertTypeAnd(env.findRequest('http://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev'), 'object', 'http host-meta.json');
              env.assertNoRequest(test);
              test.result(true);
            }, 100);
          }, 100);
        }
      },

      {
        desc: "getStorageInfo forwards successfully retrieved HTTPS profile",
        run: function(env, test) {
          var webfingerResult;
          env.webfinger.getStorageInfo('me@local.dev').
            then(function(result) {
              webfingerResult = result;
            });
          setTimeout(function() {
            var reqs = [
              env.findRequest('https://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev')
            ];
            reqs[0].promise.reject();
            reqs[1].promise.reject();
            reqs[2].promise.fulfill('{"links":[{"rel":"remoteStorage","href":"https://local.dev/storage/me","type":"https://www.w3.org/community/rww/wiki/read-write-web-00#simple","properties":{"auth-method":"https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2","auth-endpoint":"https://local.dev/auth/me"}}]}');
            
            setTimeout(function() {
              test.assertTypeAnd(webfingerResult, 'object', 'getStorageInfo promise not fulfilled');
              console.log('got object: ', webfingerResult);
              test.assert({
                rel: 'remoteStorage',
                href: 'https://local.dev/storage/me',
                type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
                properties: {
                  "auth-method": "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
                  "auth-endpoint": "https://local.dev/auth/me"
                }
              }, webfingerResult);
            }, 100);
          }, 100);
        }
      },


      {
        desc: "getStorageInfo forwards successfully retrieved HTTP profile",
        run: function(env, test) {
          var webfingerResult;
          env.webfinger.getStorageInfo('me@local.dev').
            then(function(result) {
              webfingerResult = result;
            });
          setTimeout(function() {
            var httpsReqs = [
              env.findRequest('https://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'),
              env.findRequest('https://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev')
            ];

            httpsReqs.forEach(function(req) { req.promise.reject(); });

            setTimeout(function() {
              var reqs = [
                env.findRequest('http://local.dev/.well-known/webfinger?resource=acct:me%40local.dev'),
                env.findRequest('http://local.dev/.well-known/host-meta?resource=acct:me%40local.dev'),
                env.findRequest('http://local.dev/.well-known/host-meta.json?resource=acct:me%40local.dev')
              ];

              reqs[0].promise.reject();
              reqs[1].promise.reject();
              reqs[2].promise.fulfill('{"links":[{"rel":"remoteStorage","href":"https://local.dev/storage/me","type":"https://www.w3.org/community/rww/wiki/read-write-web-00#simple","properties":{"auth-method":"https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2","auth-endpoint":"https://local.dev/auth/me"}}]}');
              
              setTimeout(function() {
                test.assertTypeAnd(webfingerResult, 'object', 'getStorageInfo promise not fulfilled');
                test.assert({
                  rel: 'remoteStorage',
                  href: 'https://local.dev/storage/me',
                  type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
                  properties: {
                    "auth-method": "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
                    "auth-endpoint": "https://local.dev/auth/me"
                  }
                }, webfingerResult);
              }, 100);
            }, 100);
          }, 100);
        }
      },

      {
        desc: "getStorageInfo sets the correct default timeout",
        run: function(env, test) {
          env.webfinger.getStorageInfo('you@remote.dev');
          setTimeout(function() {
            var req = env.findRequest('https://remote.dev/.well-known/webfinger?resource=acct:you%40remote.dev');
            test.assertTypeAnd(req, 'object', 'request not found');
            test.assert(req.options.timeout, 10000);
          }, 100);
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
          setTimeout(function() {
            var req = env.findRequest('https://remote.dev/.well-known/webfinger?resource=acct:you%40remote.dev');
            test.assertTypeAnd(req, 'object', 'request not found');
            test.assert(req.options.timeout, 15000);
          }, 100);
        }
      }

    ]
    
  });

  return suites;

});
