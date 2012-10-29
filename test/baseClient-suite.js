module.exports = function() {
  var suites = [];

  suites.push({
    name: "baseClient.js tests",
    desc: "a collection of tests for baseClient.js",
    setup: function(env) {
      if (typeof define !== 'function') {
        var define = require('amdefine')(module);
      }
      var requirejs = require('requirejs');
      requirejs.config({
        // can't we specify the base repository dir instead of having to
        // juggle relative paths?
        baseUrl: __dirname+'/../src/',
        nodeRequire: require
      });
      var _this = this;
      requirejs(['lib/baseClient'], function(baseClient) {
        _this.assertType(baseClient, 'function');
      });
    },
    tests: [
      {
        desc: "initial test",
        run: function(env) {
          this.result(true);
        }
      }
    ]
  });
  return suites;
}();