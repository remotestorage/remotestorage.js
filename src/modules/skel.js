
/**
 ** Skeleton for new modules
 **/

define(['../remoteStorage'], function(remoteStorage) {

  var moduleName = "changeMe";

  remoteStorage.defineModule(moduleName, function(privClient, pubClient) {

    // module initialization goes here

    return {

      name: moduleName,

      dataHints: {
        // documentation goes here
      },

      exports: {
        // module's public interface goes here
      }
    };

  });

  return remoteStorage[moduleName]; // for AMD loaders

});
