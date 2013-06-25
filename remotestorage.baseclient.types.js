
(function() {

  RemoteStorage.BaseClient.prototype.declareType = function(alias, type, schema) {
    if(! schema) {
      schema = type;
      type = 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
    }
  }

})();