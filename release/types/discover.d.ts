import type { StorageInfo } from './interfaces/storage_info';
/**
 * This function deals with the Webfinger lookup, discovering a connecting
 * user's storage details.
 *
 * @param {string} userAddress - user@host or URL
 *
 * @returns {Promise} A promise for an object with the following properties.
 *          href - Storage base URL,
 *          storageApi - RS protocol version,
 *          authUrl - OAuth URL,
 *          properties - Webfinger link properties
 **/
declare const Discover: {
    (userAddress: string): Promise<StorageInfo>;
    DiscoveryError(message: any): void;
    _rs_init(): void;
    _rs_supported(): boolean;
    _rs_cleanup(): void;
};
export = Discover;
//# sourceMappingURL=discover.d.ts.map