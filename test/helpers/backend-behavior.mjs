import { expect } from 'chai';

/**
 * Shared "backend behavior" assertions for remote-storage backend adapters
 * (Dropbox, Google Drive, etc.). Replaces the Jaribu-era
 * `test/behavior/backend.js` module.
 *
 * Pass a function that returns a freshly constructed (un-connected) backend
 * client; the helper wraps the assertions in a `describe` block so the caller
 * can compose them inside their own suite.
 *
 * @example
 *   import { backendBehavior } from '../helpers/backend-behavior.mjs';
 *   describe('Dropbox', () => {
 *     backendBehavior(() => new Dropbox(new RemoteStorage()));
 *   });
 */
export function backendBehavior(getFreshClient) {
  describe('backend behavior', () => {
    let client;

    beforeEach(() => {
      client = getFreshClient();
    });

    it("is initially not connected", () => {
      expect(client.connected).to.equal(false);
    });

    it("exposes a stopWaitingForToken function", () => {
      expect(client.stopWaitingForToken).to.be.a('function');
      expect(client.stopWaitingForToken()).to.be.undefined;
    });
  });
}
