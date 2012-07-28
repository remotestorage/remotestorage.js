define([
  './remoteStorage',
], function(remoteStorage) {

  window.remoteStorage = remoteStorage;

  define(['./remoteStorage-modules'], function() {});


});