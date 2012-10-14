var fs=require('fs'),
  requirejs = require('requirejs'),
  modules = require('./modules');

function deepCopy(object) {
  var o = {}, keys = Object.keys(object);
  for(var i=0;i<keys.length;i++) {
    var k = keys[i], v = object[keys[i]];
    o[k] = (typeof(v) === 'object') ? deepCopy(v) : v;
  }
  return o;
}


//normal build:
var defaults = {
  baseUrl: '../src',
  name: '../build/lib/almond',
  wrap: {
    startFile: 'start.frag',
    endFile:'end.frag'
  }
};

function build(output, inputs, options) {
  var config = deepCopy(defaults);
  if(! options) {
    options = {};
  }
  if(! (inputs instanceof Array)) {
    inputs = [inputs];
  }
  if(options.start) {
    config.wrap.startFile = options.start;
  }
  if(options.end) {
    config.wrap.endFile = options.end;
  }
  if(options.debug) {
    config.optimize = 'none';
  }

  config.include = inputs;
  config.out = output + '.js';

  console.log('BUILD', output, 'FROM', inputs, 'WITH', options);

  requirejs.optimize(config);
}

if(process.argv[2] == 'debug') {
  build('latest/remoteStorage-debug', 'remoteStorage', { debug: true });
  build('latest/remoteStorage-modules-debug', 'remoteStorage-modules', { end: 'endModules.frag', debug: true });
} else {
  build('latest/remoteStorage', 'remoteStorage');
  build('latest/remoteStorage-debug', 'remoteStorage', { debug: true });
  build('latest/remoteStorage-node', 'remoteStorage', { end: 'endNode.frag' });
  build('latest/remoteStorage-node-debug', 'remoteStorage', { end: 'endNode.frag', debug: true });


  build('latest/remoteStorage-modules', 'remoteStorage-modules', { end: 'endModules.frag' });
  build('latest/remoteStorage-modules-debug', 'remoteStorage-modules', { end: 'endModules.frag', debug: true });

}

// var mods = modules.map(function(module) {
//   return 'modules/' + module.name;
// });

// build('latest/remoteStorage-modules', mods, { end: 'endModules.frag' });
// build('latest/remoteStorage-modules-debug', mods, { end: 'endModules.frag', debug: true });
