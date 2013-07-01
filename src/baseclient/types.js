
(function() {

  RemoteStorage.BaseClient.Types = {
    uris: {},
    schemas: {},
    aliases: {},

    declare: function(moduleName, alias, uri, schema) {
      var fullAlias = moduleName + '/' + alias;

      if(schema.extends) {
        var extendedAlias;
        var parts = schema.extends.split('/');
        if(parts.length === 1) {
          extendedAlias = moduleName + '/' + parts.shift();
        } else {
          extendedAlias = parts.join('/');
        }
        var extendedUri = this.uris[extendedAlias];
        if(! extendedUri) {
          throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
        }
        schema.extends = this.schemas[extendedUri];
      }
      
      this.uris[fullAlias] = uri;
      this.aliases[uri] = fullAlias
      this.schemas[uri] = schema;
    }
  };

  RemoteStorage.BaseClient.prototype.declareType = function(alias, uri, schema) {
    if(! schema) {
      schema = uri;
      uri = 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
    }
    RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
  }

})();