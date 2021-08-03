/**
 * The default config, merged with the object passed to the constructor of the
 * RemoteStorage object
 */
declare const config: {
    cache: boolean;
    changeEvents: {
        local: boolean;
        window: boolean;
        remote: boolean;
        conflict: boolean;
    };
    cordovaRedirectUri: any;
    logging: boolean;
    modules: any[];
    backgroundSyncInterval: number;
    disableFeatures: any[];
    discoveryTimeout: number;
    isBackground: boolean;
    requestTimeout: number;
    syncInterval: number;
};
export = config;
//# sourceMappingURL=config.d.ts.map