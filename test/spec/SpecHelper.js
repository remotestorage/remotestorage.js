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
      return jasmine.currentEnv_.files[fileName].module;
    },
    getModule: function(moduleName) {
      return jasmine.currentEnv_.modules[moduleName];
    },
    getPrivateBaseClient: function(moduleName) {
      return jasmine.currentEnv_.privateBaseClients[moduleName];
    },
    getPublicBaseClient: function(moduleName) {
      return jasmine.currentEnv_.publicBaseClients[moduleName];
    },
    getStub: function(moduleName, stubName) {
      var stub = jasmine.currentEnv_.files[moduleName].stubs[stubName];
      stub.reset();
      return stub;
    }
  };
})();
