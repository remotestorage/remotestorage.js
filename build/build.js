var fs=require('fs'),
  requirejs = require('requirejs');
var config = {
  baseUrl: '../src',
  name: 'remoteStorage',
  out: 'latest/remoteStorage.js',
  wrap: {
    startFile: 'start.frag',
    endFile:'end.frag'
  }
};
requirejs.optimize(config);
var nodeConfig = config;
nodeConfig.out='latest/remoteStorage-node.js';
nodeConfig.wrap.endFile='endNode.frag';

requirejs.optimize(nodeConfig);
