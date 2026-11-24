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

    it("reports a failed reset instead of opening the database again", () => {
      const open = sinon.stub().returns({
        result: { objectStoreNames: createObjectStoreNames(new Set()), close() {} }
      });
      const deleteRequest = {};
      const callback = sinon.spy();
      sinon.stub(console, "error");

      globalThis.indexedDB = {
        open,
        deleteDatabase() {
          return deleteRequest;
        }
      };

      IndexedDB.open("remotestorage", callback);
      open.firstCall.returnValue.onsuccess();
      deleteRequest.onerror("delete failed");

      expect(open.calledOnce).to.equal(true);
      expect(callback.calledOnceWith("delete failed")).to.equal(true);
    });

    it("closes the database when another connection wants to delete or upgrade it", () => {
      const close = sinon.spy();
      const db = {
        objectStoreNames: createObjectStoreNames(new Set(["nodes", "changes"])),
        close
      };
      const request = { result: db };

      globalThis.indexedDB = {
        open() {
          return request;
        }
      };

      IndexedDB.open("remotestorage", () => {});
      request.onsuccess();
      db.onversionchange();

      expect(close.calledOnce).to.equal(true);
    });
  });

  describe("after another tab closed the connection", () => {
    function createDb(name, stored) {
      const db = {
        name,
        objectStoreNames: createObjectStoreNames(new Set(["nodes", "changes"])),
        closed: false,
        close() { db.closed = true; },
        transaction() {
          if (db.closed) {
            throw new Error("InvalidStateError: the connection is closing");
          }
          const transaction = {
            objectStore() {
              return {
                get(path) {
                  const req = {};
                  setTimeout(() => {
                    req.onsuccess({ target: { result: stored[path] } });
                    transaction.oncomplete();
                  }, 0);
                  return req;
                },
                put() {},
                delete() {}
              };
            }
          };
          return transaction;
        }
      };
      return db;
    }

    function openWith(dbs) {
      const open = sinon.stub().callsFake(() => {
        const request = { result: dbs[open.callCount - 1] };
        setTimeout(() => request.onsuccess(), 0);
        return request;
      });
      globalThis.indexedDB = { open };
      return open;
    }

    async function openBackend(open) {
      const db = await new Promise((resolve, reject) => {
        IndexedDB.open("remotestorage", (err, result) => err ? reject(err) : resolve(result));
      });
      return { db, local: new IndexedDB(db), open };
    }

    it("reopens the database for the next read", async () => {
      const first = createDb("remotestorage", {});
      const second = createDb("remotestorage", { "/foo": { path: "/foo" } });
      const { db, local, open } = await openBackend(openWith([first, second]));

      db.onversionchange();
      expect(first.closed).to.equal(true);

      const nodes = await local.getNodes(["/foo"]);

      expect(open.calledTwice).to.equal(true);
      expect(local.db).to.equal(second);
      expect(nodes["/foo"]).to.deep.equal({ path: "/foo" });
    });

    it("reopens only once for concurrent reads", async () => {
      const first = createDb("remotestorage", {});
      const second = createDb("remotestorage", {});
      const { db, local, open } = await openBackend(openWith([first, second]));

      db.onversionchange();
      await Promise.all([local.getNodesFromDb(["/a"]), local.getNodesFromDb(["/b"])]);

      expect(open.calledTwice).to.equal(true);
    });

    it("rejects the read when the database can't be reopened", async () => {
      const first = createDb("remotestorage", {});
      const open = sinon.stub();
      open.onFirstCall().callsFake(() => {
        const request = { result: first };
        setTimeout(() => request.onsuccess(), 0);
        return request;
      });
      open.onSecondCall().callsFake(() => {
        const request = { error: "VersionError" };
        setTimeout(() => request.onerror(), 0);
        return request;
      });
      globalThis.indexedDB = { open };
      const { db, local } = await openBackend(open);

      db.onversionchange();

      let error;
      try {
        await local.getNodesFromDb(["/foo"]);
      } catch (e) {
        error = e;
      }
      expect(error).to.equal("VersionError");
    });

    it("doesn't start a second flush while reopening for a write", async () => {
      const first = createDb("remotestorage", {});
      const second = createDb("remotestorage", {});
      const { db, local } = await openBackend(openWith([first, second]));

      db.onversionchange();
      const setNodesInDb = sinon.spy(local, "setNodesInDb");
      await local.setNodes({ "/a": { path: "/a" } });
      await local.setNodes({ "/b": { path: "/b" } });

      expect(setNodesInDb.calledOnce).to.equal(true);
      expect(local.putsRunning).to.equal(1);

      clearInterval(local.commitSlownessWarning);
    });
  });

  describe("#reset", () => {
    it("passes a failed delete on to the callback", (done) => {
      const closedDb = { name: "remotestorage", close() {} };
      const reopened = {
        name: "remotestorage",
        objectStoreNames: createObjectStoreNames(new Set(["nodes", "changes"]))
      };
      const deleteRequest = {};
      sinon.stub(console, "error");

      globalThis.indexedDB = {
        deleteDatabase() {
          return deleteRequest;
        },
        open() {
          const request = { result: reopened };
          setTimeout(() => request.onsuccess(), 0);
          return request;
        }
      };

      const local = new IndexedDB(closedDb);
      local.reset((result) => {
        expect(result).to.equal("delete failed");
        expect(local.db).to.equal(reopened);
        done();
      });
      deleteRequest.onerror("delete failed");
    });
  });

  describe("._rs_cleanup", () => {
    it("resolves when deleting the database fails", async () => {
      const deleteRequest = {};
      sinon.stub(console, "error");

      globalThis.indexedDB = {
        deleteDatabase() {
          return deleteRequest;
        }
      };

      const cleanup = IndexedDB._rs_cleanup({});
      deleteRequest.onerror(new Event("error"));

      await cleanup;
    });
  });
});
