if(typeof(define) !== 'function') {
  var define = require('amdefine').define;
}
define(['requirejs'], function(requirejs) {
  var suites = [];

  // suites.push({
  //   name: "getputdelete",
  //   desc: "a REST client",
  //   setup: function(env) {
  //     var _this = this;
  //     requirejs([
  //       './src/lib/platform'
  //     ], function(platform) {
  //       platform.testMode();
  //       requirejs([
  //         './src/lib/getputdelete',
  //       ], function(getputdelete) {
  //         env.getputdelete = getputdelete;
  //         _this.result(true);
  //       });
  //     });
  //   },
  //   tests: [
  //     {
  //       desc: "get returns a promise",
  //       run: function(env) {
  //         this.assertType(
  //           env.getputdelete.get("https://example.com/foo", "access-token").then,
  //           'function'
  //         );
  //       },
        
  //     }
  //   ]
  // });

  return suites;
});