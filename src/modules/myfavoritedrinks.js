remoteStorage.defineModule('myfavoritedrinks', function(privateClient) {
	
	// Resolve a conflict where a drink is added that has also been added
	// in another instance of the app by always taking the local one.
	// Note: Usually it makes sense to have this behavior in the app code
	// but in this case the module can handle it itself as this automatic
	// resolution won't destroy any data.
	privateClient.on('conflict', function(event) {
		event.resolve('local');
	});
	
	return {
		exports: {
			
			on: privateClient.on,
			
			addDrink: function(name) {
				var id = name.toLowerCase().replace(/\s|\//g, '-');
				return privateClient.storeObject('drink', id, {
					name: name
				});
			},
			
			removeDrink: privateClient.remove,
			
			listDrinks: function() {
				return privateClient.getAll('');
			}
			
		}
	};
});
