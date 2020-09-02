import EventHandling from './eventhandling';
/**
 * Provides a high-level interface to access data below a given root path.
 */
declare function BaseClient(storage: any, base: string): void;
declare namespace BaseClient {
    var Types: import("./types").BaseClientTypes;
    var _rs_init: () => void;
}
interface BaseClient extends EventHandling {
}
export default BaseClient;
//# sourceMappingURL=baseclient.d.ts.map