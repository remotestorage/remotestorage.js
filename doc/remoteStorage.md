### Module management

#### defineModule(moduleName, builder)

Defines a new module with the given *moduleName*.

The given *builder* will be given two arguments:
* privateClient
* publicClient

Both are instances of *baseClient*, the first accesses the private category, the second the public.

Example:

    defineModule('sandwiches', function(privateClient, publicClient) {
    
      return {
      
        // will GET /public/sandwiches/favSandwich
        getPublicFavourite: function() {
          publicClient.getObject('favSandwich');
        },
        
        // will GET /sandwiches/favSandwich
        getPrivateFavourite: function() {
          privateClient.getObject('favSandwich');
        }
   
      }
    
    });
    
The *builder* won't be called immediately, but rather when *loadModule* is called.

#### loadModule(moduleName, mode)

Loads a module with the given *moduleName*. The module's source has to be loaded (i.e. you should load remoteStorage-modules.js), otherwise an exception is thrown.
The optional *mode* parameter can be 'r' (read-only) or 'rw' (read-write). It defaults to 'r'.

By loading the module, it's scopes are added to the widget and access is claimed on those with the specified *mode*.

Example:

    remoteStorage.loadModule('tasks', 'r');
    remoteStorage.tasks; // returns the module's instance.

If the module has already been loaded, this method won't do anything.

#### getModuleInfo(moduleName)

Returns an object, populated with information about the given module.
What info exactly that is, is currently undefined.
If the module is unknown, returns undefined.

#### getModuleList()

Returns the list of known (i.e. defined) moduleNames. Those modules aren't necessarily loaded.

#### getLoadedModuleList()

Returns the list of loaded (i.e. defined and available)
