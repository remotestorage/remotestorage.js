import "mocha";
import { expect } from "chai";
import sinon from "sinon";

import IndexedDB from "../../build/indexeddb.js";

function createObjectStoreNames(stores) {
  return {
    contains(name) {
      return stores.has(name);
    }
  };
}

describe("IndexedDB", () => {
  let originalIndexedDB;

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB;
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
    sinon.restore();
  });

  describe(".open", () => {
    it("creates missing object stores during upgrades regardless of old version", (done) => {
      const stores = new Set();
      const db = {
        objectStoreNames: createObjectStoreNames(stores),
        createObjectStore(name) {
          stores.add(name);
        }
      };
      const request = { result: db };

      globalThis.indexedDB = {
        open() {
          return request;
        }
      };

      IndexedDB.open("remotestorage", (err, openedDb) => {
        expect(err).to.equal(null);
        expect(openedDb).to.equal(db);
        expect(stores.has("nodes")).to.equal(true);
        expect(stores.has("changes")).to.equal(true);
        done();
      });

      request.onupgradeneeded({
        oldVersion: 1,
        newVersion: 2
      });
      request.onsuccess();
    });

    it("closes a database with missing object stores before deleting it", () => {
      const close = sinon.spy();
      const stores = new Set(["changes"]);
      const db = {
        objectStoreNames: createObjectStoreNames(stores),
        close
      };
      const openRequest = { result: db };
      const deleteRequest = {};

      globalThis.indexedDB = {
        open() {
          return openRequest;
        },

        deleteDatabase() {
          expect(close.calledOnce).to.equal(true);
          return deleteRequest;
        }
      };

      IndexedDB.open("remotestorage", () => {});

      openRequest.onsuccess();

      expect(close.calledOnce).to.equal(true);
      expect(deleteRequest.onblocked).to.be.a("function");
    });
  });
});
