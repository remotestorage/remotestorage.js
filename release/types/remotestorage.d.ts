import Authorize from './authorize';
import EventHandling from './eventhandling';
import SyncError from './sync-error';
import UnauthorizedError from './unauthorized-error';
import * as util from './util';
/**
 * Constructor for the remoteStorage object.
 *
 * This class primarily contains feature detection code and convenience API.
 *
 * Depending on which features are built in, it contains different attributes
 * and functions. See the individual features for more information.
 *
 * @param {object} config - an optional configuration object
 * @class
 */
declare const RemoteStorage: {
    (cfg: any): void;
    Authorize: typeof Authorize;
    SyncError: typeof SyncError;
    Unauthorized: typeof UnauthorizedError;
    DiscoveryError: (message: any) => void;
    util: typeof util;
};
interface RemoteStorage extends EventHandling {
}
export default RemoteStorage;
