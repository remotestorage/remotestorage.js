var fs=require('fs'),
  requirejs = require('requirejs');

//normal build:
var config = {
  baseUrl: '../src',
  name: 'remoteStorage',
  out: 'latest/remoteStorage.js',
  wrap: {
    startFile: 'start.frag',
    endFile:'end.frag'
  },
};
requirejs.optimize(config);

//debug build:
config.optimize = 'none';
config.wrap.startFile = 'startDebug.frag';
config.out = 'latest/remoteStorage-debug.js';

//node build:
requirejs.optimize(config);
delete config.optimize;
config.out = 'latest/remoteStorage-node.js';
config.wrap.startFile = 'start.frag';
config.wrap.endFile = 'endNode.frag';
requirejs.optimize(config);
