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
    getRemoteStorage: function() {
      return jasmine.currentEnv_.remoteStorage;
    },
    getFile: function(fileName) {
      return jasmine.currentEnv_.files[fileName];
    },
    getModule: function(moduleName) {
      return jasmine.currentEnv_.modules[moduleName];
    }
  };
})();
