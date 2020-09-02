import EventHandling from './eventhandling';
/**
 * Class : WireClient
 **/
declare const WireClient: {
    (rs: any): void;
    isArrayBufferView: any;
    request(method: string, url: string, options: unknown): Promise<Response | XMLHttpRequest>;
    /** options includes body, headers and responseType */
    _fetchRequest(method: string, url: string, options: any): Promise<Response>;
    _xhrRequest(method: any, url: any, options: any): Promise<XMLHttpRequest>;
    _rs_init(remoteStorage: any): void;
    _rs_supported(): boolean;
    _rs_cleanup(): void;
};
interface WireClient extends EventHandling {
}
export default WireClient;
