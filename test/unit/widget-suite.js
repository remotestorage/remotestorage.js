if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}

define(['requirejs'], function(requirejs) {
  var suites = [];

  global.localStorage = require('localStorage');

  function stubWidgetView(util) {
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
        './src/lib/baseClient'
      ], function(util, widget, sync, wireClient, baseClient) {
        env.widget = widget;
        env.view = stubWidgetView(util);
        env.widget.setView(env.view);
        env.sync = sync;
        env.wireClient = wireClient;
        env.baseClient = baseClient;

        env.fakeRemoteStorage = {
          claimedModules: { foo: 'rw' }
        };

        env.view._results['getLocation'] = 'http://test.host/';
        _this.result(true);
      });
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
          this.assertAnd(env.sync.hasHandler('busy'), true);
          this.assertAnd(env.sync.hasHandler('ready'), true);
          this.assertAnd(env.sync.hasHandler('error'), true);
          this.assertAnd(env.sync.hasHandler('timeout'), true);
          this.assertAnd(env.wireClient.hasHandler('connected'), true);
          this.assertAnd(env.wireClient.hasHandler('disconnected'), true);
          this.assert(env.baseClient.hasHandler('error'), true);
        }
      },

      {
        desc: "widget.display strips all params from the fragment",
        run: function(env) {
          env.view._results['getLocation'] = 'http://test.host/#abc=def&user_address=foo@bar.baz';
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          expectCall(this, env.view, 'setLocation', ['http://test.host/#']) &&
            expectCall(this, env.view, 'setUserAddress', ['foo@bar.baz']) &&
            this.result(true);
        }
      },

      {
        desc: "forwards sync busy / ready state to the view",
        run: function(env) {
          env.widget.display(env.fakeRemoteStorage, 'remotestorage-connect', {});
          env.sync.emit('busy');
          if(! expectCall(this, env.view, 'setState', ['busy'])) {
            return;
          }
          env.sync.emit('ready');
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
      }

    ]
  });
  
  return suites;
});
