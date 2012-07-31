(function() {
  var exports={}, deps={}, mods={};
  function define(name, relDeps, code){
    name = String(name);
    exports[name]=code;
    var dir = name.substring(0,name.lastIndexOf('/')+1);
    deps[name]=[];
    for(var i=0;i<relDeps.length;i++) {
      if(relDeps[i].substring(0,2)=='./') {//TODO: proper path parsing here
        relDeps[i]=relDeps[i].substring(2);
      }
      if(relDeps[i].substring(0,3)=='../') {//TODO: proper path parsing here
        relDeps[i]=relDeps[i].substring(3);
        var dirParts = dir.split('/');
        dirParts.pop();
        dirParts.pop();
        dir = dirParts.join('/');
        if(dir.length) {
          dir += '/';
        }
      }
      deps[name].push(dir+relDeps[i]);
    }

    if(name === 'remoteStorage') {
      remoteStorage = _loadModule('remoteStorage');
    }
  }
  function _loadModule(name) {
    if(name=='require') {//not including that one, out!
      return function(){};
    }
    var modNames = deps[name];
    console.log('loading module '+name);
    console.log('typeof dependencies: '+typeof(modNames));
    for(var i=0;i<modNames.length;i++) {
      if(!mods[modNames[i]]) {
        console.log('loading '+modNames[i]);
        mods[modNames[i]]=_loadModule(modNames[i]);
      } else {
        console.log('already loaded '+modNames[i]);
      }
    }
    var modList=[];
    for(var i=0;i<modNames.length;i++) {
      modList.push(mods[modNames[i]]);
    }
    return exports[name].apply({}, modList);
  }
