if (typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['./src/revisioncache'], function (RevisionCache) {
  var suites = [];

  suites.push({
    name: "RevisionCache",
    desc: "Local folders revision caching",
    setup: function(env, test) {
      test.done();
    },

    beforeEach: function(env, test) {
      env.revCache = new RevisionCache('rev');
      test.done();
    },

    tests: [
      {
        desc: "#set with propagation enabled updates the revision of parent folders",
        run: function(env, test) {
          env.revCache.activatePropagation();
          env.revCache.set('/foo/bar',1);
          test.assertAnd(env.revCache.get('/foo/bar'), 1);
          test.assertFailAnd(env.revCache.get('/foo/'), 'rev');
          test.assertFail(env.revCache.get('/'), 'rev');
        }
      },
      {
        desc: "#set with propagation disabled does not update the revision of parent folders",
        run: function(env, test) {
          env.revCache.deactivatePropagation();
          env.revCache.set('/foo/bar',1);
          test.assertAnd(env.revCache.get('/foo/bar'), 1);
          test.assertAnd(env.revCache.get('/foo/'), 'rev');
          test.assert(env.revCache.get('/'), 'rev');
        }
      },
      {
        desc: "#delete with propagation enabled updates the revision of parent folders",
        run: function(env, test) {
          env.revCache.activatePropagation();
          env.revCache.set('/foo/bar',1);
          var revFoo = env.revCache.get('/foo/');
          var revRoot = env.revCache.get('/');
          env.revCache.delete('/foo/bar');
          test.assertAnd(env.revCache.get('/foo/bar'), null);
          test.assertFailAnd(env.revCache.get('/foo/'), revFoo);
          test.assertFail(env.revCache.get('/'), revRoot);
        }
      },
      {
        desc: "#delete with propagation disabled does not update the revision of parent folders",
        run: function(env, test) {
          env.revCache.deactivatePropagation();
          env.revCache.set('/foo/bar',1);
          var revFoo = env.revCache.get('/foo/');
          var revRoot = env.revCache.get('/');
          env.revCache.delete('/foo/bar');
          test.assertAnd(env.revCache.get('/foo/bar'), null);
          test.assertAnd(env.revCache.get('/foo/'), revFoo);
          test.assert(env.revCache.get('/'), revRoot);
        }
      },
      {
        desc: "#activatePropagation updates the revision of changed folders",
        run: function(env, test) {
          env.revCache.deactivatePropagation();
          env.revCache.set('/foo/bar',1);
          env.revCache.activatePropagation();
          test.assertFailAnd(env.revCache.get('/foo/'), 'rev');
          test.assertFail(env.revCache.get('/'), 'rev');
        }
      },
      {
        desc: "folders revision remain the same even if changes are not provided in the same order",
        run: function(env, test) {
          env.revCache.activatePropagation();
          env.revCache.set('/foo/bar',1);
          env.revCache.set('/foo/bar2',1);
          env.revCache.set('/foo/bar3',1);
          env.revCache.set('/foo/bar4',1);
          env.revCache.set('/foo2/bar',1);
          env.revCache.set('/foo2/bar2',1);
          env.revCache.set('/foo2/bar3',1);
          env.revCache.set('/foo2/bar4',1);
          var revFoo = env.revCache.get('/foo/');
          var revFoo2 = env.revCache.get('/foo2/');
          var revRoot = env.revCache.get('/');
          env.revCache = new RevisionCache('rev');
          env.revCache.activatePropagation();
          env.revCache.set('/foo2/bar4',1);
          env.revCache.set('/foo/bar3',1);
          env.revCache.set('/foo2/bar3',1);
          env.revCache.set('/foo/bar',1);
          env.revCache.set('/foo/bar4',1);
          env.revCache.set('/foo/bar2',1);
          env.revCache.set('/foo2/bar2',1);
          env.revCache.set('/foo2/bar',1);
          test.assertAnd(env.revCache.get('/foo/'), revFoo);
          test.assertAnd(env.revCache.get('/foo2/'), revFoo2);
          test.assert(env.revCache.get('/'), revRoot);
        }
      },

    ]
  });

  return suites;
});
