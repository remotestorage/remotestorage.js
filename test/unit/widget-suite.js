if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs'], function(requirejs) {
  var suites = [];

  var util;

  global.localStorage = require('localStorage');

  function stubWidgetView() {
    var calls = [], results = {};
    return util.extend(
      // stub state
      { _calls: calls, _results: results },
      // event emitter
      util.getEventEmitter('connect', 'disconnect', 'sync', 'reconnect'),
      // method stubs
      ['display',
       'setState',
       'redirectTo',
       'setUserAddress',
       'getLocation',
       'setLocation'
      ].reduce(function(stubs, method) {
        stubs[method] = function() {
          calls.push({
            method: method,
            args: util.toArray(arguments)
          });
          return results[method];
        };
        return stubs;
      }, {})
    );
  }

  function argEq(expected, actual) {
    for(var i=0;i<expected.length;i++) {
      if(expected[i] !== actual[i]) {
        return false;
      }
    }
    return true;
  }
  
  function expectCall(test, object, methodName, args) {
    for(var i=0;i<object._calls.length;i++) {
      var call = object._calls[i];
      if(call.method === methodName) {
        if((! args) || argEq(args, call.args)) {
          return test.assertAnd(true, true);
        }
      }
    }
    return test.assertAnd(true, false);
  }

  suites.push({
    name: "widget.js tests",
    desc: "widget controller implementation",
    setup: function(env) {
      var _this = this;
      requirejs([
        './src/lib/util',
        './src/lib/widget', 
        './src/lib/sync', 
        './src/lib/wireClient', 
        './src/lib/baseClient', 
        './src/lib/getputdelete', 
        './src/lib/webfinger',
        './src/lib/access'
      ], function(_util, widget, sync, wireClient, baseClient, getputdelete, webfinger, Access) {
        util = _util;
        env.widget = widget;
        env.view = stubWidgetView();
        env.widget.setView(env.view);
        env.sync = sync;
        env.wireClient = wireClient;
        env.baseClient = baseClient;
        env.getputdelete = getputdelete;
        env.webfinger = webfinger;
        env.Access = Access;

        env.origGetStorageInfo = env.webfinger.getStorageInfo;
        env.webfinger.getStorageInfo = function() {
          var promise = util.getPromise();
          env.fakefinger.push({
            args: util.toArray(arguments),
            promise: promise
          });
          return promise;
        }

        env.fakeRemoteStorage = {
          access: new env.Access()
        };

        env.fakeRemoteStorage.access.claim('foo', 'rw');

        env.view._results['getLocation'] = 'http://test.host/';
        _this.result(true);
      });
    },

    takedown: function(env, test) {
      env.webfinger.getStorageInfo = env.origGetStorageInfo;
      test.result(true);
    },

    beforeEach: function(env, test) {
      env.fakefinger = [];
      test.result(true);
    },

    afterEach: function(env, test) {
      // clean up event handlers after each test
      env.sync.reset();
      env.wireClient.reset();
      env.baseClient.reset();
      test.result(true);
    },

    tests: [

      {
        desc: "widget.display sets up event handlers on the view",
        run: function(env) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          this.assertAnd(env.view.hasHandler('connect'), true);
          this.assertAnd(env.view.hasHandler('sync'), true);
          this.assertAnd(env.view.hasHandler('disconnect'), true);
          this.assert(env.view.hasHandler('reconnect'), true);
        }
      },

      {
        desc: "widget.display sets up event handlers on sync, wireClient and baseClient",
        run: function(env) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          this.assertAnd(env.sync.hasHandler('error'), true);
          this.assertAnd(env.sync.hasHandler('timeout'), true);
          this.assertAnd(env.wireClient.hasHandler('connected'), true);
          this.assertAnd(env.wireClient.hasHandler('disconnected'), true);
          this.assertAnd(env.wireClient.hasHandler('busy'), true);
          this.assertAnd(env.wireClient.hasHandler('unbusy'), true);
          this.assert(env.baseClient.hasHandler('error'), true);
        }
      },

      {
        desc: "widget.display strips all params from the fragment",
        run: function(env) {
          env.view._results['getLocation'] = 'http://test.host/#abc=def&remotestorage=foo@bar.baz';
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          expectCall(this, env.view, 'setLocation', ['http://test.host/#']) &&
            expectCall(this, env.view, 'setUserAddress', ['foo@bar.baz']) &&
            this.result(true);
        }
      },

      {
        desc: "forwards wireClient busy / unbusy state to the view",
        run: function(env) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          env.wireClient.emit('busy');
          if(! expectCall(this, env.view, 'setState', ['busy'])) {
            return;
          }
          env.wireClient.emit('unbusy');
          if(! expectCall(this, env.view, 'setState', ['connected'])) {
            return;
          }
          this.result(true);
        }
      },

      {
        desc: "forwards wireClient connected / disconnected state to the view",
        run: function(env) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          // FIXME: won't work, because 'initialSync' causes errors
          // env.wireClient.emit('connected');
          // if(! expectCall(this, env.view, 'setState', ['connected'])) {
          //   return;
          // }
          env.wireClient.emit('disconnected');
          if(! expectCall(this, env.view, 'setState', ['initial'])) {
            return;
          }
          this.result(true);
        }
      },

      {
        desc: "increases timeout for webfinger and getputdelete, when 'timeout' event is fired from sync",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          // initially set to 1s
          env.getputdelete.setTimeout(1000);
          env.webfinger.setTimeout(1000);
          env.sync.emit('timeout');
          util.nextTick(function() {
            test.assertAnd(env.getputdelete.getTimeout(), 1500);
            test.assert(env.webfinger.getTimeout(), 1500);
          });
        }
      },

      {
        desc: "adjusts timeout on webfinger 'timeout' error",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          env.getputdelete.setTimeout(1000);
          env.webfinger.setTimeout(1000);
          env.view.emit('connect', 'foo@bar.baz');
          util.nextTick(function() {
            var storageInfoReq = env.fakefinger.shift();
            test.assertTypeAnd(storageInfoReq, 'object', "expected webfinger.getStoageInfo to have been called!");
            test.assertAnd(storageInfoReq.args[0], 'foo@bar.baz');
            storageInfoReq.promise.reject('timeout');
            util.nextTick(function() {
              test.assertAnd(env.getputdelete.getTimeout(), 1500);
              test.assert(env.webfinger.getTimeout(), 1500);
            });
          });
        }
      },

      {
        desc: "#display() redirects correctly after the webfinger discovery",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          env.view.emit('connect', 'foo@bar.baz');
          util.nextTick(function() {
            env.fakefinger.shift().promise.fulfill({
              rel: 'remotestorage',
              type: 'remotestorage-00',
              href: 'http://local.dev/storage/me',
              properties: {
                'auth-method': '',
                'auth-endpoint': 'http://local.dev/auth/me'
              }
            });
            setTimeout(function() {
              var redirectCall = env.view._calls.pop();
              test.assertAnd(redirectCall.method, 'redirectTo');
              test.assertAnd(redirectCall.args.length, 1);
              var url = redirectCall.args[0];
              test.assertAnd(url.split('?')[0], 'http://local.dev/auth/me');
              var params = {};
              url.split('?')[1].split('&').forEach(function(part) {
                var kv = part.split('=').map(decodeURIComponent);
                params[kv[0]] = kv[1];
              });
              // the result from getLocation
              test.assertAnd(params.redirect_uri, 'http://test.host/');
              // determined through env.fakeRemoteStorage
              test.assertAnd(params.scope, 'foo:rw');
              test.assertAnd(params.response_type, 'token');
              test.done();
            }, 150);
          });
        }
      },

      {
        desc: "#display() allows overriding the redirect_uri through options",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {
            redirectUri: 'http://other/place'
          });
          env.view.emit('connect', 'foo@bar.baz');
          util.nextTick(function() {
            env.fakefinger.shift().promise.fulfill({
              rel: 'remotestorage',
              type: 'remotestorage-00',
              href: 'http://local.dev/storage/me',
              properties: {
                'auth-method': '',
                'auth-endpoint': 'http://local.dev/auth/me'
              }
            });
            setTimeout(function() {
              var redirectCall = env.view._calls.pop();
              test.assertAnd(redirectCall.method, 'redirectTo');
              test.assertAnd(redirectCall.args.length, 1);
              var url = redirectCall.args[0];
              test.assertAnd(url.split('?')[0], 'http://local.dev/auth/me');
              var params = {};
              url.split('?')[1].split('&').forEach(function(part) {
                var kv = part.split('=').map(decodeURIComponent);
                params[kv[0]] = kv[1];
              });
              test.assert(params.redirect_uri, 'http://other/place');
            }, 150);
          });
        }
      },

      {
        desc: "a redirect_uri containing a fragment strips the fragment before setting the parameter",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {
            redirectUri: 'http://other/place#foo'
          });
          env.view.emit('connect', 'foo@bar.baz');
          util.nextTick(function() {
            env.fakefinger.shift().promise.fulfill({
              rel: 'remotestorage',
              type: 'remotestorage-00',
              href: 'http://local.dev/storage/me',
              properties: {
                'auth-method': '',
                'auth-endpoint': 'http://local.dev/auth/me'
              }
            });
            setTimeout(function() {
              var redirectCall = env.view._calls.pop();
              test.assertAnd(redirectCall.method, 'redirectTo');
              test.assertAnd(redirectCall.args.length, 1);
              var url = redirectCall.args[0];
              test.assertAnd(url.split('?')[0], 'http://local.dev/auth/me');
              var params = {};
              url.split('?')[1].split('&').forEach(function(part) {
                var kv = part.split('=').map(decodeURIComponent);
                params[kv[0]] = kv[1];
              });
              test.assert(params.redirect_uri, 'http://other/place');
            }, 150);
          });
        }
      },

      {
        desc: "a redirect_uri containing a fragment sets the 'state' parameter to the fragment",
        run: function(env, test) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {
            redirectUri: 'http://other/place#foo'
          });
          env.view.emit('connect', 'foo@bar.baz');
          util.nextTick(function() {
            env.fakefinger.shift().promise.fulfill({
              rel: 'remotestorage',
              type: 'remotestorage-00',
              href: 'http://local.dev/storage/me',
              properties: {
                'auth-method': '',
                'auth-endpoint': 'http://local.dev/auth/me'
              }
            });
            setTimeout(function() {
              var redirectCall = env.view._calls.pop();
              test.assertAnd(redirectCall.method, 'redirectTo');
              test.assertAnd(redirectCall.args.length, 1);
              var url = redirectCall.args[0];
              test.assertAnd(url.split('?')[0], 'http://local.dev/auth/me');
              var params = {};
              url.split('?')[1].split('&').forEach(function(part) {
                var kv = part.split('=').map(decodeURIComponent);
                params[kv[0]] = kv[1];
              });
              test.assert(params.state, 'foo');
            }, 150);
          });
        }
      },


      {
        desc: "#display() recovers the fragment from the 'state' parameter",
        run: function(env, test) {
          env.view._results['getLocation'] = 'http://test.host/#abc=def&remotestorage=foo@bar.baz&state=foobar';
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          expectCall(test, env.view, 'setLocation', ['http://test.host/#foobar']);
          test.done();
        }
      }

    ]
  });
  
  return suites;
});
