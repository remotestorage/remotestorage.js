window.testEnv = {};
testEnv.modules={};
testEnv.files={};
testEnv.privateBaseClients={};
testEnv.publicBaseClients={};

remoteStorage = {};

function makeStub(name) {
  var nameParts = name.split('/');
  name = nameParts.pop();
  function setResponses(arr) {
    this._responses = arr;
  }
  function doF(name, params) {
    this._called.push({name: name, params: params});
    return this._responses.shift();
  }
  function getCalled() {
    return this._called;
  }
  function reset() {
    this._called=[];
    this._responses=[];
    return this;
  }
  var obj = {
    _responses: [],
    _called: [],
    name: name,
    stub: {},
    setResponses: setResponses,
    getCalled: getCalled,
    reset: reset,
    addFunc: function(name, numExports) {
      this.stub[name] = function() {
        if(typeof(numExports) === 'function') {
          return numExports.apply(this, arguments);
        } else if(numExports === 'forward') { 
          return testEnv.files[obj.name].module[name].apply(this, arguments);
        } else {
          var a = [];
          for(var i=0;i<numExports;i++) {
            a.push(arguments[i]);
          }
          return doF.apply(obj, [name, a]);
        }
      };
    }
  };
  if(testEnv.files[name] && testEnv.files[name].exports) {
    for(var i in testEnv.files[name].exports) {
      obj.addFunc(i, testEnv.files[name].exports[i]);
    }
  }
  return obj;
}

var define;
function setDefine(name, exports) {
  define = function(deps, cb) {
    var obj = {stubs: {}};
    var pass = [];
    var dep;
    for(var i=0; i< deps.length; i++) {
      dep = deps[i].split('/').pop();
      obj.stubs[dep]=makeStub(dep);
      pass.push(obj.stubs[dep].stub);
    }
    obj.module = cb.apply(this, pass);
    obj.exports = exports || obj.module;
    testEnv.files[name]=obj;
  };
}
