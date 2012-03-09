(function() {
  var exports={}, deps={};
  function define(name, relDeps, code){
    exports[name]=code;
    var dir = name.substring(0,name.lastIndexOf('/')+1);
    deps[name]=[];
    for(var i=0;i<relDeps.length;i++) {
      if(relDeps[i].substring(0,2)=='./') {//TODO: proper path parsing here
        relDeps[i]=relDeps[i].substring(2);
      }
      deps[name].push(dir+relDeps[i]);
    }
  }
  function loadModule(name) {
    if(name=='require') {//not including that one, out!
      return function(){};
    }
    var modNames = deps[name];
    var mods={};
    for(var i=0;i<modNames.length;i++) {
      mods[modNames[i]]=loadModule(modNames[i]);
    }
    var modList=[];
    for(var i=0;i<modNames.length;i++) {
      modList.push(mods[modNames[i]]);
    }
    return exports[name].apply({}, modList);
  }
