function makeStubClient() {
  var called = [],
  responses = [];
  function setResponses(arr) {
    responses=arr;
  }
  function doF(name, params) {
    called.push({name: name, params: params});
    return responses.shift();
  }
  function getCalled() {
    return called;
  }
  function reset() {
    called=[];
    responses=[];
    return this;
  }
  return {
    setResponses: setResponses,
    getCalled: getCalled,
    sync: function(path, switchVal) { return doF('sync', [path, switchVal]); },
    getObject: function(path) { return doF('getObject', [path]); },
    storeObject: function(type, path, obj) { return doF('storeObject', [type, path, obj]); },
    getDocument: function(path) { return doF('getDocument', [path]); },
    storeDocument: function(type, path, data) { return doF('storeDocument', [type, path, data]); },
    getListing: function(path) { return doF('getListing', [path]); },
    remove: function(path) { return doF('remove', [path]); },
    getCurrentWebRoot: function() { return doF('getCurrentWebRoot', []); }
  };
}

remoteStorage.defineModule = function(moduleName, cb) {
  testEnv.privateBaseClients[moduleName] = makeStubClient();
  testEnv.publicBaseClients[moduleName] = makeStubClient();
  testEnv.modules[moduleName] = cb(testEnv.privateBaseClients[moduleName], testEnv.publicBaseClients[moduleName]);
}

