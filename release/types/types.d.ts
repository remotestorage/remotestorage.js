/// <reference types="tv4" />
import type { JsonSchemas } from './interfaces/json_schema';
/**
 * - Manages and validates types of remoteStorage objects, using JSON-LD and
 *   JSON Schema
 * - Adds schema declaration/validation methods to BaseClient instances.
 **/
export declare class BaseClientTypes {
    /**
     * <alias> -> <uri>
     */
    uris: {
        [key: string]: string;
    };
    /**
     * Contains schema objects of all types known to the BaseClient instance
     *
     * <uri> -> <schema>
     */
    schemas: JsonSchemas;
    /**
     * <uri> -> <alias>
     */
    aliases: {
        [key: string]: string;
    };
    /**
     * Called via public function BaseClient.declareType()
     *
     * @private
     */
    declare(moduleName: string, alias: string, uri: string, schema: tv4.JsonSchema): void;
    resolveAlias(alias: string): string;
    getSchema(uri: string): tv4.JsonSchema;
    inScope(moduleName: string): JsonSchemas;
}
declare const Types: BaseClientTypes;
export default Types;
//# sourceMappingURL=types.d.ts.map