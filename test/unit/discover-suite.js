if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['bluebird', 'requirejs', 'fs', 'webfinger.js'], function (Promise, requirejs, fs, WebFinger) {

  global.Promise = Promise;
  global.WebFinger = WebFinger;

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
        XMLHttpRequest.onOpen = function () {};


        XMLHttpRequest.prototype = {
          open: function () {
            XMLHttpRequest.openCalls.push(Array.prototype.slice.call(arguments));
            XMLHttpRequest.onOpen(arguments);
          },

          send: function (data) {
            XMLHttpRequest.sendCalls.push(Array.prototype.slice.call(arguments));
            if (typeof XMLHttpRequest.onreadystatechange === 'function') {
              XMLHttpRequest.onreadystatechange();
            }
          },
          setRequestHeader: function (p) {}
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
          XMLHttpRequest.onOpen = function () {
            test.assertAnd(XMLHttpRequest.openCalls.length, 1);
            test.assertAnd(XMLHttpRequest.openCalls[0][0], 'GET');
            test.assertAnd(XMLHttpRequest.openCalls[0][1], 'https://heahdk.net/.well-known/webfinger?resource=acct:nil@heahdk.net');
            test.assert(XMLHttpRequest.openCalls[0][2], true); // cross-origin
          };

          RemoteStorage.Discover('nil@heahdk.net').then(function (r) {
            test.done();
          });
        }
      },

      {
        desc: "it finds href, type and authURL, when the remotestorage version is in the link type",
        run: function (env, test) {
          RemoteStorage.Discover('nil@heahdk.net').then(function (info) {
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

          XMLHttpRequest.onOpen = function () {
            var xhr = XMLHttpRequest.instances[0];
            xhr.status = 200;
            xhr.readyState = 4;
            xhr.responseText = JSON.stringify({
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
            xhr.onreadystatechange();
          };
        }
      },

      {
        desc: "# localhost:port should work",
        run: function (env, test) {
          RemoteStorage.Discover('me@localhost:8001').then(function (info) {
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

          XMLHttpRequest.onOpen = function (params) {
            test.assert(params[1], 'http://localhost:8001/.well-known/webfinger?resource=acct:me@localhost:8001');
          };
        }
      },

      {
        desc: "it finds href, type, authURL, and properties for draft-05-style link rels",
        run: function (env, test) {
          //TODO: clear the cache of the discover instance inbetween tests.
          //for now, we use a different user address in each test to avoid interference
          //between the previous test and this one when running the entire suite.
          RemoteStorage.Discover('nil1@heahdk.net').then(function (info) {
            test.assertAnd(info, {
              href: 'https://base/url',
              storageType: 'draft-dejong-remotestorage-05',
              authURL: 'https://auth/url',
              properties: {
                'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-05',
                'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
              }
            });
            test.done();
          });
          XMLHttpRequest.onOpen = function () {
            var xhr = XMLHttpRequest.instances[0];
            xhr.status = 200;
            xhr.readyState = 4;
            xhr.responseText = JSON.stringify({
              links: [
                {
                  rel: 'http://tools.ietf.org/id/draft-dejong-remotestorage',
                  href: 'https://base/url',
                  properties: {
                    'http://remotestorage.io/spec/version': 'draft-dejong-remotestorage-05',
                    'http://tools.ietf.org/html/rfc6749#section-4.2': 'https://auth/url'
                  }
                }
              ]
            });
            xhr.onreadystatechange();
          };
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
          XMLHttpRequest.onOpen = function () {
            var xhr = XMLHttpRequest.instances[0];
            xhr.status = 200;
            xhr.readyState = 4;
            xhr.responseText = JSON.stringify({
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
            xhr.onreadystatechange();
          };
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
          RemoteStorage.Discover("foo@bar").then(test.fail, function (err) {
            test.assertType(err, 'string');
          });
          XMLHttpRequest.onOpen = function () {
            var xhr = XMLHttpRequest.instances[0];
            xhr.status = 200;
            xhr.readyState = 4;
            xhr.responseText = '';
            xhr.onreadystatechange();
          };
        }
      }
    ]
  });

  return suites;
});
