if(typeof(define) !== 'function') {
  var define = require('amdefine').define;
}
define(['requirejs'], function() {

  var suites = [];

  // suites.push({
  //   name: "wireClient suite",
  //   desc: "the wireClient holds storage information and queries the storage",
  //   setup: function(env) {
  //     var _this = this;
  //     requirejs([
  //       './src/lib/wireClient'
  //     ], function(wireClient) {
  //       env.wireClient = wireClient;
  //       _this.result(true);
  //     });
  //   },
  //   tests: [
  //     {
  //       desc: "get returns a promise",
  //       run: function(env) {
  //         try {
  //           this.assertType(env.wireClient.get('/foo').then, 'function');
  //         } catch(exc) {
  //           console.log(exc.stack);
  //           this.result(false);
  //         }
  //       }
  //     },
  //     // {
  //     //   desc: "get calls getputdelete",
  //     //   run: function(env) {

  //     //   }
  //     // }
  //   ]
  // });

  return suites;
});