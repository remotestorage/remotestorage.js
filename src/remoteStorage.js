define('remoteStorage', [
  'require',
  './lib/widget',
  './lib/baseClient',
  './lib/store',
  './lib/sync',
  './lib/wireClient'
], function(require, widget, baseClient, store, sync, wireClient) {

  var claimedModules = {}, modules = {};

  function deprecate(oldFn, newFn) {
    console.error("DEPRECATION: " + oldFn + " is deprecated! Use " + newFn + " instead.");
  }

  var remoteStorage =  {

    /**
     ** PUBLIC METHODS
     **/

    /** defineModule() - define a new module, with given name.
     **
     ** Module names MUST be unique. The given builder will be called
     ** immediately, with two arguments, which are both instances of
     ** baseClient. The first accesses the private section of a modules
     ** storage space, the second the public one. The public area can
     ** be read by any client (not just an authenticated one), while
     ** it can only be written by an authenticated client with read-write
     ** access claimed on it.
     **
     ** The builder is expected to return an object, as described under
     ** getModuleInfo().
     ** 
     **/
    defineModule: function(moduleName, builder) {
      console.log('DEFINE MODULE', moduleName);
      var module = builder(
        // private client:
        baseClient.getInstance(moduleName, false),
        // public client:
        baseClient.getInstance(moduleName, true)
      );
      modules[moduleName] = module;
      this[moduleName] = module.exports;
      console.log('Module defined: ' + moduleName, module, this);
    },

    /** getModuleList() - Get an Array of all moduleNames, currently defined.
     ** 
     **/
    getModuleList: function() {
      return Object.keys(modules);
    },

    /** getClaimedModuleList() - Get a list of all modules, currently claimed
     **                          access on.
     **
     **/
    getClaimedModuleList: function() {
      return Object.keys(claimedModules);
    },

    /** getModuleInfo() - Retrieve meta-information about a given module.
     **
     ** If the module doesn't exist, the result will be undefined.
     **
     ** Module information currently gives you the following (if you're lucky):
     **
     ** * exports - don't ever use this. it's basically the module's instance.
     ** * name - the name of the module, but you knew that already.
     ** * dataHints - an object, describing internas about the module.
     **
     ** Some of the dataHints used are:
     **
     **   objectType <type> - description of an object
     **                       type implemented by the module:
     **     "objectType message"
     **
     **   <attributeType> <objectType>#<attribute> - description of an attribute
     **
     **     "string message#subject"
     **
     **   directory <path> - description of a path's purpose
     **
     **     "directory documents/notes/"
     **
     **   item <path> - description of a special item
     **
     **     "item documents/notes/calendar"
     **
     ** Hope this helps.
     **
     **/
    getModuleInfo: function(moduleName) {
      return modules[moduleName];
    },

    /** claimAccess() - Claim access for a set of modules.
     **
     ** You need to claim access to a module before you can
     ** access data from it.
     ** 
     ** modules can be specified in three ways:
     **
     ** * via an object:
     **
     **   remoteStorage.claimAccess({
     **     contacts: 'r',
     **     documents: 'rw',
     **     money: 'r'
     **   });
     **
     ** * via an array:
     **
     **   remoteStorage.claimAccess(['contacts', 'documents', 'money']);
     **
     ** * via variable arguments:
     **
     **   remoteStorage.claimAccess('contacts', 'documents', 'money');
     **
     ** In both the array and argument list call sequence, access will
     ** by default be claimed read-write ('rw'), UNLESS the last argument
     ** (not the last member of the array) is either the string 'r' or 'rw':
     **
     **   remoteStorage.claimAccess('documents', 'rw');
     **   remoteStorage.claimAccess(['money', 'documents'], 'r');
     **
     ** Errors:
     **
     ** claimAccess() will throw an exception, if any given module hasn't been
     ** defined (yet). Access to all previously processed modules will have been
     ** claimed, however.
     ** 
     **/
    claimAccess: function(modules) {
      if(typeof(modules) !== 'object' || (modules instanceof Array)) {
        if(! modules instanceof Array) {
          modules = arguments;
        }
        var _modules = modules, mode = 'rw';
        modules = {};

        var lastArg = arguments[arguments.length - 1];

        if(typeof(lastArg) === 'string' && lastArg.match(/^rw?$/)) {
          mode = lastArg;
          delete arguments[arguments.length - 1];
        }
        
        for(var i=0;i<_modules.length;i++) {
          modules[_modules] = mode;
        }
      }
      for(var moduleName in modules) {
        this.claimModuleAccess(moduleName, modules[moduleName]);
      }
    },

    /** claimModuleAccess() - Claim access to a single module.
     ** We probably don't need this out in the public, as
     ** claimAccess() provides the same interface.
     **/
    claimModuleAccess: function(moduleName, mode) {
      if(! moduleName in modules) {
        throw "Module not defined: " + moduleName;
      }

      if(moduleName in claimedModules) {
        return;
      }

      if(! mode) {
        mode = 'r';
      }
      if(moduleName == 'root') {
        moduleName = '';
        widget.addScope('', mode);
        baseClient.claimAccess('/', mode);
      } else {
        widget.addScope(moduleName, mode);
        baseClient.claimAccess('/'+moduleName+'/', mode);
        baseClient.claimAccess('/public/'+moduleName+'/', mode);
      }
      claimedModules[moduleName] = true;
    },

    loadModule: function() {
      deprecate('remoteStorage.loadModule', 'remoteStorage.claimAccess');
      this.claimModuleAccess.apply(this, arguments);
    },

    /** setBearerToken() - Set bearer token and claim additional scopes.
     ** Bearer token will usually be received via a #access_token=
     ** fragment after authorization.
     ** You don't need this, if you are using the widget.
     **/
    setBearerToken: function(bearerToken, claimedScopes) {
      wireClient.setBearerToken(bearerToken);
      baseClient.claimScopes(claimedScopes);
    },

    /**
     ** DELEGATED METHODS
     **/

    disconnectRemote : wireClient.disconnectRemote,

    /** flushLocal() - Forget this ever happened.
     ** 
     ** Delete all locally stored data.
     ** This doesn't clear localStorage, just removes everything
     ** remoteStorage.js ever saved there (though obviously only under
     ** the current origin).
     **
     ** To implement logging out, use (at least) this.
     **
     **/
    flushLocal       : store.forgetAll,

    /** syncNow(path) - Synchronize local <-> remote storage.
     ** 
     ** Syncing starts at given path and bubbles down.
     ** The actual changes to either local or remote storage happen in the
     ** future, so you should attach change handlers on the modules you're
     ** interested in.
     **
     ** Example:
     **   remoteStorage.money.on('change', function(changeEvent) {
     **     updateBudget(changeEvent);
     **   });
     **   remoteStorage.syncNow('/money');
     **
     ** Modules may bring their own sync method, which should take preference
     ** over the one here.
     **
     **/
    syncNow          : sync.syncNow,

    /** displayWidget(element) - Display the widget in the given DOM element.
     **
     ** The argument given, can either be a DOM ID, or a element reference.
     ** In either case, the element MUST be attached to the DOM tree at the
     ** time of calling displayWidget().
     **/
    displayWidget    : widget.display,

    getWidgetState   : widget.getState,
    setStorageInfo   : wireClient.setStorageInfo

  };

  return remoteStorage;
});
