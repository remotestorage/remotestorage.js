if(typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [],
      __;

  suites.push({
    name: "L10N Suite",
    desc: "testing localization",

    setup: function(env, test){
      global.RemoteStorage = {};
      require('src/l10n.js');
      __ = RemoteStorage.L10n;
      test.done();
    },

    beforeEach: function(env, test){
      test.done();
    },

    tests: [
      {
        desc: "l10n getter / setter",
        run: function(env,test){
          RemoteStorage.L10n.setDict({"KEY1": "Hello %s, I'm %s"});
          var dict = RemoteStorage.L10n.getDict();
          test.assertAnd(Object.keys(dict).length, 1, "Number of dictionnary keys");
          test.assertAnd(Object.keys(dict)[0], "KEY1", "Value of dictionnary keys");
          test.assertAnd(dict["KEY1"], "Hello %s, I'm %s", "Dictionnary values");
          test.done();
        }
      },

      {
        desc: "Basic l10n",
        run: function(env,test){
          RemoteStorage.L10n.setDict({"KEY1": "Hello %s, I'm %s"});
          test.assert(__("KEY1", "foo", "bar"), "Hello foo, I'm bar");
          test.done();
        }
      },

      {
        desc: "Unknown key",
        run: function(env,test){
          var log = "";
          console.log = function(msg) {
            log = msg;
          };
          RemoteStorage.L10n.setDict({"KEY1": "Hello %s, I'm %s"});
          test.assertAnd(__("KEY2", "foo", "bar"), "KEY2", "Key not translated");
          test.assertAnd(log, "Unknown string KEY2", "Message in logs");
          test.done();
        }
      }
    ]
  });

  return suites;
});
