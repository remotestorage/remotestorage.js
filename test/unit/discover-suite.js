if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'fs'], function(Promise, requirejs, fs) {
  global.Promise = Promise;
  var suites = [];

  suites.push({
    name: "Discover",
    desc: "Webfinger discovery",
    setup: function(env, test) {
      global.RemoteStorage = function() {};
      RemoteStorage.log = function() {};
      global.RemoteStorage.prototype.localStorageAvailable = function() { return false; };
      require('./src/discover');
      if (global.rs_util) {
        RemoteStorage.discover = global.rs_discover;
      } else {
        global.rs_discover = RemoteStorage.discover;
      }


      test.done();
    },

    beforeEach: function(env, test) {
      if (typeof(XMLHttpRequest) === 'function') {
        XMLHttpRequest.instances = [];
        XMLHttpRequest.openCalls = [];
        XMLHttpRequest.sendCalls = [];
        XMLHttpRequest.prototype = {
          open: function() {
            XMLHttpRequest.openCalls.push(Array.prototype.slice.call(arguments));
          },

          send: function() {
            XMLHttpRequest.sendCalls.push(Array.prototype.slice.call(arguments));
          }
        };
        ['load', 'abort', 'error'].forEach(function(cb) {
          Object.defineProperty(XMLHttpRequest.prototype, 'on' + cb, {
            configurable: true,
            set: function(f) {
              XMLHttpRequest['on' + cb + 'Function'] = f;
            }
          });
        });
      }
      test.done();
    },

    tests: [
      // these tests MUST be run before any other.

      {
        desc: "it isn't supported with no XMLHttpRequest",
        run: function (env, test) {
          delete global.XMLHttpRequest; // in case it was declared by another test.
          test.assert(RemoteStorage.Discover._rs_supported(), false);
        }
      },

      {
        desc: "it is supported when XMLHttpRequest is defined",
        run: function (env, test) {
          global.XMLHttpRequest = function() {
            XMLHttpRequest.instances.push(this);
          };
          test.assert(RemoteStorage.Discover._rs_supported(), true);
        }
      },

      {
        desc: "initialization works",
        run: function (env, test) {
          var rs = new RemoteStorage();
          RemoteStorage.Discover._rs_init(rs);
          test.done();
        }
      },

      {
        desc: "it tries /.well-known/webfinger",
        run: function (env, test) {
          RemoteStorage.Discover('nil@heahdk.net');
          test.assertAnd(XMLHttpRequest.openCalls.length, 1);
          test.assertAnd(XMLHttpRequest.openCalls[0][0], 'GET');
          test.assertAnd(XMLHttpRequest.openCalls[0][1], 'https://heahdk.net/.well-known/webfinger?resource=acct%3Anil%40heahdk.net');
          test.assertAnd(XMLHttpRequest.openCalls[0][2], true); // cross-origin
          test.done();
        }
      },

      {
        desc: "it finds href, type and authURL, when the remotestorage version is in the link type",
        run: function (env, test) {
          RemoteStorage.Discover('nil@heahdk.net').then(function(info) {
            test.assertAnd(info, {
              href: 'https://base/url',
              storageType: 'draft-dejong-remotestorage-01',
              authURL: 'https://auth/url',
              properties: {
                'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
              }
            });
            test.done();
          });
          var instance = XMLHttpRequest.instances[0];
          instance.status = 200;
          instance.responseText = JSON.stringify({
            links: [
              {
                rel: 'remotestorage',
                type: 'draft-dejong-remotestorage-01',
                href: 'https://base/url',
                properties: {
                  'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
                }
              }
            ]
          });
          XMLHttpRequest.onloadFunction();
        }
      },

      {
        desc: "it finds href, type, authURL, and properties when the remotestorage version is in a link property",
        run: function (env, test) {
          //TODO: clear the cache of the discover instance inbetween tests.
          //for now, we use a different user address in each test to avoid interference
          //between the previous test and this one when running the entire suite.
          RemoteStorage.Discover('nil2@heahdk.net').then(function (info) {
            test.assertAnd(info, {
              href: 'https://base/url',
              storageType: 'draft-dejong-remotestorage-02',
              authURL: 'https://auth/url',
              properties: {
                'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-02',
                'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
              }
            });
            test.done();
          });
          var instance = XMLHttpRequest.instances[0];
          instance.status = 200;
          instance.responseText = JSON.stringify({
            links: [
              {
                rel: 'remotestorage',
                href: 'https://base/url',
                properties: {
                  'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-02',
                  'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
                }
              }
            ]
          });
          XMLHttpRequest.onloadFunction();
        }
      },

      {
        desc: "when running the previous test a second time, it makes no xhr request, but you get the same answer",
        run: function (env, test) {
          //TODO: clear the cache of the discover instance inbetween tests.
          //for now, we use a different user address in each test to avoid interference
          //between the previous test and this one when running the entire suite.
          RemoteStorage.Discover('nil2@heahdk.net').then(function (info) {
            test.assertAnd(info, {
              href: 'https://base/url',
              storageType: 'draft-dejong-remotestorage-02',
              authURL: 'https://auth/url',
              properties: {
                'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-02',
                'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
              }
            });
            test.done();
          });
          test.assertAnd(XMLHttpRequest.instances[0], undefined);
        }
      },

      {
        desc: "if unsuccesfully tried to discover a storage, promise is rejected",
        run: function (env, test) {
          RemoteStorage.Discover("foo@bar").then(undefined, function(err) {
            test.assertType(err, 'string');
          });
          for (var i = 0; i < 4; i++) {
            var instance = XMLHttpRequest.instances[i];
            instance.status = 200;
            XMLHttpRequest.onloadFunction();
          }
        }
      }
    ]
  });

  return suites;
});
