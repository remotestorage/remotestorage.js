if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['util', 'require', './build/eventhandling', './build/solid',
        './build/config', './build/util', 'test/behavior/backend',
        'test/helpers/mocks'],
       function (util, require, EventHandling, Solid, config, buildUtil,
                 backend, mocks) {

  var suites = [];

  function setup (env, test) {
    global.localStorage = {
      setItem: function() {},
      removeItem: function() {}
    };

    class RemoteStorage {
      setBackend (b) { this.backend = b; }
    }
    buildUtil.applyMixins(RemoteStorage, [EventHandling]);
    global.RemoteStorage = RemoteStorage;

    global.Authorize = require('./build/authorize');

    test.done();
  }

  function beforeEach(env, test) {
    env.rs = new RemoteStorage();
    env.rs.addEvents(['error', 'wire-busy', 'wire-done', 'network-offline', 'network-online']);
    var oldLocalStorageAvailable = util.localStorageAvailable;
    util.localStorageAvailable = function() { return true; };
    env.client = new Solid(env.rs);
    env.connectedClient = new Solid(env.rs);
    util.localStorageAvailable = oldLocalStorageAvailable;

    /*
    {
  "href": "https://solidcommunity.net",
  "userAddress": "https://yasharpm.solidcommunity.net/profile/ca"
  "properties": {
    "sessionProperties": {
      "clientId": "f3746db1ad9c6e83ec2c3ef76fd7dba5",
      "clientSecret": "43ef2f966cbd1d6a974a9af590847daf",
      "idTokenSignedResponseAlg": "RS256",
      "sessionId": "any",
      "codeVerifier": "3099e5e6e8d14a1c9a0ad328a2421d5a6f8f30f7c7b648c48326dd987df5ccf4c285700f206c4f4d8d24aacf664e1823",
      "issuer": "https://solidcommunity.net",
      "redirectUrl": "https://8080-pondersource-devstock-73mdx98iw45.ws-eu115.gitpod.io/",
      "dpop": "true"
    },
    "podURL": "https://yasharpm.solidcommunity.net/"
  }
}
    */

    env.baseURI = 'https://example.com/storage/test';
    env.connectedClient.configure({
      userAddress: 'soliduser',
      href: env.baseURI,
      properties: {
        podURL: 'https://example.com/storage/test'
      }
    });

    mocks.defineMocks(env);

    env.busy = new test.Stub(function(){});
    env.done = new test.Stub(function(){});
    env.networkOffline = new test.Stub(function(){});
    env.networkOnline = new test.Stub(function(){});
    env.rs.on('wire-busy', env.busy);
    env.rs.on('wire-done', env.done);
    env.rs.on('network-offline', env.networkOffline);
    env.rs.on('network-online', env.networkOnline);

    test.done();
  }

  function afterEach(env, test) {
    mocks.undefineMocks(env);
    delete env.client;
    test.done();
  }

  suites.push({
    name: "Solid",
    desc: "backend behavior",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: backend.behavior
  });

  var tests = [
    {
      desc: "#configure sets 'connected' to true, once sessionProperties is given",
      run: function (env, test) {
        env.client.configure({
          sessionProperties: { }
        });
        test.assert(env.client.connected, true);
      }
    },

    {
      desc: "#configure sets userAddress when given",
      run: function (env, test) {
        env.client.configure({
          userAddress: 'john.doe@gmail.com'
        });
        test.assert(env.client.userAddress, 'john.doe@gmail.com');
      }
    },

    
  ];

  suites.push({
    name: "Solid",
    desc: "Solid back-end",
    setup: setup,
    beforeEach: beforeEach,
    afterEach: afterEach,
    tests: tests
  });


  return suites;
});

