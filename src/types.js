  var tv4 = require('tv4');
  var BaseClient = require('./baseclient');

  /**
   * Class: BaseClient.Types
   *
   * - Manages and validates types of remoteStorage objects, using JSON-LD and
   *   JSON Schema
   * - Adds schema declaration/validation methods to BaseClient instances.
   **/
  BaseClient.Types = {
    /**
     * <alias> -> <uri>
     */
    uris: {},

    /**
     * Contains schema objects of all types known to the BaseClient instance
     *
     * <uri> -> <schema>
     */
    schemas: {},

    /**
     * <uri> -> <alias>
     */
    aliases: {},

    /**
     * TODO: document
     *
     * @private
     */
    declare: function(moduleName, alias, uri, schema) {
      var fullAlias = moduleName + '/' + alias;

      if (schema.extends) {
        var extendedAlias;
        var parts = schema.extends.split('/');
        if (parts.length === 1) {
          extendedAlias = moduleName + '/' + parts.shift();
        } else {
          extendedAlias = parts.join('/');
        }
        var extendedUri = this.uris[extendedAlias];
        if (! extendedUri) {
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
    },

    inScope: function(moduleName) {
      var ml = moduleName.length;
      var schemas = {};
      for (var alias in this.uris) {
        if (alias.substr(0, ml + 1) === moduleName + '/') {
          var uri = this.uris[alias];
          schemas[uri] = this.schemas[uri];
        }
      }
      return schemas;
    }
  };

  var SchemaNotFound = function(uri) {
    var error = new Error("Schema not found: " + uri);
    error.name = "SchemaNotFound";
    return error;
  };

  SchemaNotFound.prototype = Error.prototype;

  BaseClient.Types.SchemaNotFound = SchemaNotFound;

  /**
   * Class: BaseClient
   **/
  BaseClient.prototype.extend({
    /**
     * Method: declareType
     *
     * Declare a remoteStorage object type using a JSON schema.
     *
     * Parameters:
     *   alias  - A type alias/shortname
     *   uri    - (optional) JSON-LD URI of the schema. Automatically generated if none given
     *   schema - A JSON Schema object describing the object type
     *
     * Example:
     *
     * (start code)
     * client.declareType('todo-item', {
     *   "type": "object",
     *   "properties": {
     *     "id": {
     *       "type": "string"
     *     },
     *     "title": {
     *       "type": "string"
     *     },
     *     "finished": {
     *       "type": "boolean"
     *       "default": false
     *     },
     *     "createdAt": {
     *       "type": "date"
     *     }
     *   },
     *   "required": ["id", "title"]
     * })
     * (end code)
     *
     * Visit <http://json-schema.org> for details on how to use JSON Schema.
     **/
    declareType: function(alias, uri, schema) {
      if (! schema) {
        schema = uri;
        uri = this._defaultTypeURI(alias);
      }
      BaseClient.Types.declare(this.moduleName, alias, uri, schema);
    },

    /**
     * Method: validate
     *
     * Validate an object against the associated schema.
     *
     * Parameters:
     *  object - Object to validate. Must have a @context property.
     *
     * Returns:
     *   An object containing information about validation errors
     **/
    validate: function(object) {
      var schema = BaseClient.Types.getSchema(object['@context']);
      if (schema) {
        return tv4.validateResult(object, schema);
      } else {
        throw new SchemaNotFound(object['@context']);
      }
    },

    _defaultTypeURI: function(alias) {
      return 'http://remotestorage.io/spec/modules/' + encodeURIComponent(this.moduleName) + '/' + encodeURIComponent(alias);
    },

    _attachType: function(object, alias) {
      object['@context'] = BaseClient.Types.resolveAlias(this.moduleName + '/' + alias) || this._defaultTypeURI(alias);
    }
  });

  // Documented in baseclient.js
  Object.defineProperty(BaseClient.prototype, 'schemas', {
    configurable: true,
    get: function() {
      return BaseClient.Types.inScope(this.moduleName);
    }
  });

