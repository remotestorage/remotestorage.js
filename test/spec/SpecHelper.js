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
      return testEnv.remoteStorage;
    },
    getFile: function(fileName) {
      return testEnv.files[fileName].module;
    },
    getModule: function(moduleName) {
      return testEnv.modules[moduleName];
    },
    getPrivateBaseClient: function(moduleName) {
      return testEnv.privateBaseClients[moduleName];
    },
    getPublicBaseClient: function(moduleName) {
      return testEnv.publicBaseClients[moduleName];
    },
    getStub: function(moduleName, stubName, reset) {
      var stub = testEnv.files[moduleName].stubs[stubName];
      if(reset || (typeof(reset) === 'undefined')) {
        stub.reset();
      }
      return stub;
    }
  };
})();
