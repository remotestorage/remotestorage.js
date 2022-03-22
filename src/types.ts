import type { JsonSchemas } from './interfaces/json_schema';
/**
 * - Manages and validates types of remoteStorage objects, using JSON-LD and
 *   JSON Schema
 * - Adds schema declaration/validation methods to BaseClient instances.
 **/
export class BaseClientTypes {
  /**
   * <alias> -> <uri>
   */
  uris: { [key: string]: string } = {};

  /**
   * Contains schema objects of all types known to the BaseClient instance
   *
   * <uri> -> <schema>
   */
  schemas: JsonSchemas = {};

  /**
   * <uri> -> <alias>
   */
  aliases: { [key: string]: string } = {};

  /**
   * Called via public function BaseClient.declareType()
   *
   * @private
   */
  declare (moduleName: string, alias: string, uri: string, schema: tv4.JsonSchema): void {
    const fullAlias = moduleName + '/' + alias;

    if (schema.extends) {
      const parts = schema.extends.split('/');
      const extendedAlias = (parts.length === 1)
        ? moduleName + '/' + parts.shift()
        : parts.join('/');

      const extendedUri = this.uris[extendedAlias];
      if (!extendedUri) {
        throw "Type '" + fullAlias + "' tries to extend unknown schema '" + extendedAlias + "'";
      }
      schema.extends = this.schemas[extendedUri];
    }

    this.uris[fullAlias] = uri;
    this.aliases[uri] = fullAlias;
    this.schemas[uri] = schema;
  }

  resolveAlias (alias: string): string {
    return this.uris[alias];
  }

  getSchema (uri: string): tv4.JsonSchema {
    return this.schemas[uri];
  }

  inScope (moduleName: string): JsonSchemas {
    const ml = moduleName.length;
    const schemas = {};
    for (const alias in this.uris) {
      if (alias.substr(0, ml + 1) === moduleName + '/') {
        const uri = this.uris[alias];
        schemas[uri] = this.schemas[uri];
      }
    }
    return schemas;
  }
}

const Types = new BaseClientTypes();
export default Types;
