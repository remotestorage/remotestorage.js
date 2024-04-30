export default interface ConfigObserver {
    onConfigChanged(config: string): void;
}