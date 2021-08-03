declare const Features: {
    features: any[];
    featuresDone: number;
    readyFired: boolean;
    loadFeatures(): void;
    /**
     * Method: hasFeature
     *
     * Checks whether a feature is enabled or not within remoteStorage.
     * Returns a boolean.
     *
     * Parameters:
     *   name - Capitalized name of the feature. e.g. Authorize, or IndexedDB
     *
     * Example:
     *   (start code)
     *   if (remoteStorage.hasFeature('LocalStorage')) {
     *     console.log('LocalStorage is enabled!');
     *   }
     *   (end code)
     *
     */
    hasFeature(feature: any): any;
    loadFeature(featureName: any): void;
    initFeature(featureName: any): void;
    featureFailed(featureName: any, err: any): void;
    featureSupported(featureName: any, success: any): void;
    featureInitialized(featureName: any): void;
    featureDone(): void;
    _setCachingModule(): void;
    _fireReady(): void;
    featuresLoaded(): void;
    _collectCleanupFunctions(): void;
};
export = Features;
//# sourceMappingURL=features.d.ts.map