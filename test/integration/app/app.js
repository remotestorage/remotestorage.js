define(['../../../src/remoteStorage-modules.js'], function(remoteStorage) {

  var moduleName = "gruppenkasse-simple"

  remoteStorage.defineModule(moduleName, function(privateClient, publicClient){
	  
	  privateClient.sync("")
	  
	  return {
		  
		  name: moduleName,
		  
		  exports: {

			  // remoteStorage["gruppenkasse-simple"].on("change", function(changeEvent){
			  //   if(changeEvent.newValue && changeEvent.oldValue){
			  //    changeEvent.origin:
			  //      * window - event come from current window
			  //            -> ignore it
			  //      * device - same device, other tab (/window/...)
			  //      * remote - not related to this app's instance, some other app updated something on remoteStorage
			  //   }
			  // })
			  on: privateClient.on,
			  
			  getTransactions: function(){
				  var prefix = "transactions/"
				  var keys = privateClient.getListing(prefix)
				  return keys.map(function(key){
					  return privateClient.getObject(prefix + key)
				  })
			  },
			  
			  saveTransaction: function(key, data){
				  privateClient.storeObject("transaction", "transactions/" + key, data)
			  },
			  
			  removeTransaction: function(key){
				  privateClient.remove("transactions/" + key)
			  }
		  }
	  }

  })


  window.onload = function() {

    remoteStorage.claimAccess('root');

    remoteStorage.displayWidget('remotestorage-connect', {
      authDialog: 'popup'
    });
  }

});