
(function(global) {

  RemoteStorage.BaseClient.Types = {
    // <alias> -> <uri>
    uris: {},
    // <uri> -> <schema>
    schemas: {},
    // <uri> -> <alias>
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
      this.aliases[uri] = fullAlias;
      this.schemas[uri] = schema;
    },

    resolveAlias: function(alias) {
      return this.uris[alias];
    },

    getSchema: function(uri) {
      return this.schemas[uri];
    }
  };

  var SchemaNotFound = function(uri) {
    Error.apply(this, ["Schema not found: " + uri]);
  };
  SchemaNotFound.prototype = Error.prototype;

  RemoteStorage.BaseClient.prototype.extend({

    validate: function(object) {
      var schema = RemoteStorage.BaseClient.Types.getSchema(object['@context']);
      if(schema) {
        return tv4.validateResult(object, schema);
      } else {
        throw new SchemaNotFound(object['@context']);
      }
    },

    // client.declareType(alias, schema);
    //  /* OR */
    // client.declareType(alias, uri, schema);
    declareType: function(alias, uri, schema) {
      if(! schema) {
        schema = uri;
        uri = this._defaultTypeURI(alias);
      }
      RemoteStorage.BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    },

    _defaultTypeURI: function(alias) {
      return 'http://remotestoragejs.com/spec/modules/' + this.moduleName + '/' + alias;
    },

    _attachType: function(object, alias) {
      object['@context'] = RemoteStorage.BaseClient.Types.resolveAlias(alias) || this._defaultTypeURI(alias);
    }
  });

})(this);
