class SchemaNotFound extends Error {
  constructor(uri) {
    super();
    const error = new Error("Schema not found: " + uri);
    error.name = "SchemaNotFound";
    return error;
  }
}


/**
 * @class BaseClient.Types
 *
 * - Manages and validates types of remoteStorage objects, using JSON-LD and
 *   JSON Schema
 * - Adds schema declaration/validation methods to BaseClient instances.
 **/
class Types {
  SchemaNotFound = SchemaNotFound;

  /**
   * <alias> -> <uri>
   */
  uris: { [key: string]: string } = {};

  /**
   * Contains schema objects of all types known to the BaseClient instance
   *
   * <uri> -> <schema>
   */
  schemas: { [key: string]: string } = {};

  /**
   * <uri> -> <alias>
   */
  aliases: { [key: string]: string } = {};

  /**
   * Called via public function BaseClient.declareType()
   *
   * @private (though not really)
   */
  declare(moduleName, alias, uri, schema): void {
    const fullAlias = moduleName + '/' + alias;

    if(schema.extends) {
      const parts = schema.extends.split('/');
      const extendedAlias = (parts.length === 1)
        ? moduleName + '/' + parts.shift()
        : parts.join('/');

      const extendedUri = this.uris[extendedAlias];
      if(!extendedUri) {
        throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
      }
      schema.extends = this.schemas[extendedUri];
    }

    this.uris[fullAlias] = uri;
    this.aliases[uri] = fullAlias;
    this.schemas[uri] = schema;
  }

  resolveAlias(alias) {
    return this.uris[alias];
  }

  getSchema(uri) {
    return this.schemas[uri];
  }

  inScope(moduleName) {
    const ml = moduleName.length;
    const schemas = {};
    for (const alias in this.uris) {
      if(alias.substr(0, ml + 1) === moduleName + '/') {
        const uri = this.uris[alias];
        schemas[uri] = this.schemas[uri];
      }
    }
    return schemas;
  }
}

const typesAsObject = new Types();

module.exports = typesAsObject;
