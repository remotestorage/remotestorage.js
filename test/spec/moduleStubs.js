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
    getMedia: function(path) { return doF('getMedia', [path]); },
    storeMedia: function(type, path, data) { return doF('storeMedia', [type, path, data]); },
    getListing: function(path) { return doF('getListing', [path]); },
    remove: function(path) { return doF('remove', [path]); },
    getCurrentWebRoot: function() { return doF('getCurrentWebRoot', []); },
    reset: reset
  };
}
function makePlatformStub() {
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
    reset: reset,
    ajax: function(params) { return doF('ajax', [params]); },
    parseXml: function(str, cb) { return doF('parseXml', [str, cb]); },
    harvestToken: function() { return doF('harvestToken', []); },
    setElementHTML: function(eltName, html) { return doF('setElementHTML', [eltName, html]); },
    getElementValue: function(eltName) { return doF('getElementValue', [eltName]); },
    eltOn: function(eltName, eventType, cb) { return doF('eltOn', [eltName, eventType, cb]); },
    getLocation: function() { return doF('getLocation', []); },
    setLocation: function(loc) { return doF('setLocation', [loc]); },
    alert: function(str) { return doF('alert', [str]); }
  };
}
var jasmineEnv = jasmine.getEnv();
jasmineEnv.modules={};
jasmineEnv.files={};
jasmineEnv.privateBaseClients={};
jasmineEnv.publicBaseClients={};
jasmineEnv.platformStubs={};
remoteStorage = {
  defineModule: function(moduleName, cb) {
    jasmineEnv.privateBaseClients[moduleName] = makeStubClient();
    jasmineEnv.publicBaseClients[moduleName] = makeStubClient();
    jasmineEnv.modules[moduleName] = cb(jasmineEnv.privateBaseClients[moduleName], jasmineEnv.publicBaseClients[moduleName]);
  }
};

//WEBFINGER:
jasmineEnv.platformStubs['webfinger']= makePlatformStub();
function define(deps, cb) {
  jasmineEnv.files['webfinger']=cb(jasmineEnv.platformStubs['webfinger']);
};
