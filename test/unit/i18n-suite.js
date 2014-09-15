if (typeof(define) !== 'function') {
  var define = require('amdefine');
}

define([], function() {
  var suites = [],
      t;

  suites.push({
    name: "I18n Suite",
    desc: "Internationalization features",

    setup: function(env, test) {
      global.RemoteStorage = {};
      require('src/i18n.js');
      if (global.rs_I18n) {
        RemoteStorage.I18n = global.rs_I18n;
      } else {
        global.rs_I18n = RemoteStorage.I18n;
      }

      t = RemoteStorage.I18n.translate;
      test.done();
    },

    beforeEach: function(env, test) {
      test.done();
    },

    tests: [
      {
        desc: "Set/get translation dictionary",
        run: function(env,test) {
          RemoteStorage.I18n.setDictionary({"KEY1": "Hello %s, I'm %s"});
          var dict = RemoteStorage.I18n.getDictionary();
          test.assertAnd(Object.keys(dict).length, 1, "Number of dictionnary keys");
          test.assertAnd(Object.keys(dict)[0], "KEY1", "Value of dictionnary keys");
          test.assertAnd(dict["KEY1"], "Hello %s, I'm %s", "Dictionnary values");
          test.done();
        }
      },

      {
        desc: "Basic translation",
        run: function(env,test) {
          RemoteStorage.I18n.setDictionary({"KEY1": "Hello %s, I'm %s"});
          test.assert(t("KEY1", "foo", "bar"), "Hello foo, I'm bar");
        }
      },

      {
        desc: "Unknown translation key",
        run: function(env,test) {
          RemoteStorage.I18n.setDictionary({"KEY1": "Hello %s, I'm %s"});
          try {
            t("KEY2", "foo", "bar");
            test.result(false, "Unknown string KEY2 didn't fail");
          } catch(e) {
            test.result(true);
          }
        }
      }
    ]
  });

  return suites;
});
