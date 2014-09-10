define([], function() {
  return {
    behavior: [
      {
        desc: "it's initially not connected",
        run: function(env, test) {
          test.assert(env.client.connected, false);
        }
      },
      {
        desc: "stopWaitingForToken is a function",
        run: function(env, test) {
          test.assert(env.client.stopWaitingForToken(), undefined);
        }
      }
    ]
  };
});
