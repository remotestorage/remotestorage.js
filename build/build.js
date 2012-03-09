var fs=require('fs'),
  path=require('path'),
  requirejs = require('requirejs');

var compiler = (function() {
  var files={};
  var ordered={};
  function fetchModule(name) {
    if(name == path.normalize(config.baseUrl+'/require')) {
      return;
    }
    if(files[name]) {
      console.log('duplicate '+name);
      return false;
    } else {
      files[name] = fs.readFileSync(name+'.js', 'utf8');
      console.log('fetched '+name+'.js');
      return true;
    }
  }
  function compile(name) {
    var currName = path.normalize(config.baseUrl+'/'+name);
    var currDir = path.dirname(currName);
    console.log('compiling '+name+', currName='+currName+', currDir= '+currDir);
    if(fetchModule(currName)) {
      (function(moduleCode) {
        function define(listOfDependencies, functionReturningObject) {
          console.log('in our define mock, dependencies are: ');
          console.log(listOfDependencies);
          for(var i in listOfDependencies) {
            compile(currDir+'/'+listOfDependencies[i]);
          }
          //eval(functionReturningObject); we only look at which modules the current file requires in its own define, we don't go inside it.
        }
        console.log('evaluating module code for '+name+'...');
        //console.log(files);
        eval(moduleCode);
      })(files[currName]);
      ordered[currName]=true;
    }
  }
  function writeOut(fileName, objName) {
     var str='var '+objName+' = (function() {\n  var deps={}, exports={};';
     for(var i in files) {
       var moduleNameParts = i.split('/');
       var moduleName = moduleNameParts[moduleNameParts.length-1];
       str += '  (function() {\n'
         +'    function define(thisDeps, thisExports){\n'
         +'      exports["'+i+'"]=thisExports;\n'
         +'      deps["'+i+'"]=thisDeps;\n'
         +'    }\n'
         +'//////////////////\n'
         +'// '+moduleName+'\n'
         +'//\n\n'
         +files[i]
         +'\n\n//\n'
         +'// '+moduleName+'\n'
         +'//////////////////\n'
         +'  })();\n';
     }

     str +='//////////////////\n'
     for(var i in ordered) {
       var moduleNameParts = i.split('/');
       var moduleName = moduleNameParts[moduleNameParts.length-1];
       str += '  var '+moduleName+' = exports["'+i+'"].apply({},(function(){\n'
         +'    var depMods={};\n'
         +'    for(var i=0;i<deps["'+i+'"].length;i++) {\n'
         +'      depMods[i]=deps["'+i+'"][i];\n'//FIXME: the list of dependency names here will be relative to this module's dir, so that's a nightmare. aborting.
         +'    }\n'
         +'    return depMods;\n'
         +'  })());\n';
     }
     str +='//////////////////\n'
     str += '  return '+objName+';\n'
       +'})();\n';
     fs.writeFileSync(fileName, str, 'utf8');
  }
  return {
    compile: compile,
    writeOut: writeOut
  };
})();

var config = {
  baseUrl: '../src',
  name: 'remoteStorage',
  out: 'latest/remoteStorage.js',
};

compiler.compile(config.name);
compiler.writeOut(config.out, config.name);

