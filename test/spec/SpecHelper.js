var specHelper = (function() {
  return {
    setUpXhr: function() {
      sinonXhr = sinon.useFakeXMLHttpRequest();
      sinonRequests = [];
      sinonXhr.onCreate = function (xhr) {
        sinonRequests.push(xhr);
      };
    },
    tearDownXhr: function() {
      sinonXhr.restore();
    },
    setUpServer: function() {
      sinonServer = sinon.fakeServer.create();
    },
    tearDownServer: function() {
      sinonServer.restore();
    },
    getRemoteStorage: function(cb) {
      require(['../src/remoteStorage.js'], function(drop) {
        cb(drop);
      });
    }
  };
})();
