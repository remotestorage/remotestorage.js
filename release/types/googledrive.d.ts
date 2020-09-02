/**
 * @class GoogleDrive
 *
 * To use this backend, you need to specify the app's client ID like so:
 *
 * @example
 * remoteStorage.setApiKeys({
 *   googledrive: 'your-client-id'
 * });
 *
 * A client ID can be obtained by registering your app in the Google
 * Developers Console: https://console.developers.google.com/flows/enableapi?apiid=drive
 *
 * Docs: https://developers.google.com/drive/v3/web/quickstart/js
**/
import EventHandling from './eventhandling';
declare const GoogleDrive: {
    (remoteStorage: any, clientId: any): void;
    /**
     * Initialize the Google Drive backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    _rs_init(remoteStorage: any): void;
    /**
     * Inform about the availability of the Google Drive backend.
     *
     * @param {Object} rs - RemoteStorage instance
     * @returns {Boolean}
     *
     * @protected
     */
    _rs_supported(): boolean;
    /**
     * Remove Google Drive as a backend.
     *
     * @param {Object} remoteStorage - RemoteStorage instance
     *
     * @protected
     */
    _rs_cleanup(remoteStorage: any): void;
};
interface GoogleDrive extends EventHandling {
}
export default GoogleDrive;
//# sourceMappingURL=googledrive.d.ts.map