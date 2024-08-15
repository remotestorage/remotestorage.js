export interface ConfigObserver {
    onConfigChanged(config: string): void;
}