import "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";

import InMemoryStorage from "../../build/inmemorystorage.js";
import { RemoteStorage } from "../../build/remotestorage.js";
import { Sync } from "../../build/sync.js";
import FakeAccess from "../helpers/fake-access.mjs";
import UnauthorizedError from "./build/unauthorized-error.js";

chai.use(chaiAsPromised);

describe("Sync", function() {
  beforeEach(function(done) {
    this.original = {};
    this.rs = new RemoteStorage();
    Object.defineProperty(this.rs, "access", {
      value: new FakeAccess(),
      writable: true,
      configurable: true
    });

    this.rs.on("features-loaded", () => {
      this.rs._handlers["connected"] = [];
      this.rs.local = new InMemoryStorage();
      this.rs.syncStopped = true;
      this.rs.sync = new Sync(this.rs);
      this.original.doTasks = this.rs.sync.doTasks;
      this.rs.sync.doTasks = () => { return true; };
      done();
    });
  });

  afterEach(function() {
    if (this.rs.sync) { Sync._rs_cleanup(this.rs); }
    this.rs = undefined;
    sinon.reset();
  });

  describe(".rs_init", function() {
    it("sets up sync when RS instance is ready", function(done) {
      let setupSyncCycleCalled = 0;
      this.rs.setupSyncCycle = () => {
        setupSyncCycleCalled++;
        if (setupSyncCycleCalled === 1) { done(); }
      };

      Sync._rs_init(this.rs);
      this.rs._emit("ready");
    });

    it("starts syncing on connect", function(done) {
      let startSyncCalled = 0;
      this.rs.startSync = () => {
        startSyncCalled++;
        if (startSyncCalled === 1) { done(); }
      };

      Sync._rs_init(this.rs);
      this.rs._emit("connected");
    });

    it("removes the 'connected' handler when it's called", function() {
      Sync._rs_init(this.rs);
      this.rs._emit("connected");
      expect(this.rs._handlers["connected"].length).to.equal(0);
    });

    it("doesn't interfere with custom 'connected' handlers", function(done) {
      this.rs.on("connected", done);
      Sync._rs_init(this.rs);
      this.rs._emit("connected");
    });
  });

  describe(".rs_cleanup", function() {
    it("adapter removes itself from RS instance", async function() {
      expect(typeof this.rs.sync).to.equal("object");
      Sync._rs_cleanup(this.rs);
      expect(typeof this.rs.sync).to.equal("undefined");
    });
  });

  describe("#getParentPath", function() {
    it("returns the correct values", async function() {
      const paths = {
        "/a": "/",
        "/a/": "/",
        "/a/b": "/a/",
        "/a/b/": "/a/",
        "/a/b/c": "/a/b/",
        "/a/b/c/": "/a/b/"
      };

      for (const path in paths) {
        expect(this.rs.sync.getParentPath(path)).to.equal(paths[path], `The parent path of ${path} should be ${paths[path]}`);
      }
    });
  });

  describe("#sync", function() {
    it("returns immediately when not connected", async function() {
      let syncStarted = false;
      let syncDone = false;
      this.rs.remote.connected = false;
      this.rs.on("sync-started", () => { syncStarted = true; });
      this.rs.on("sync-done", () => { syncDone = true; });

      await this.rs.sync.sync().then(() => {
        expect(syncStarted).to.be.false;
        expect(syncDone).to.be.false;
      });
    });

    describe("with no need to sync", function() {
      beforeEach(function() {
        this.spies = {
          doTasks: sinon.stub(this.rs.sync, "doTasks").returns(true),
          collectTasks: sinon.spy(this.rs.sync, "collectTasks")
        };
      });

      it("does not call #collectTasks()", async function() {
        await this.rs.sync.sync();
        expect(this.spies.collectTasks.callCount).to.equal(0);
      });

      it("calls #doTasks() once", async function() {
        await this.rs.sync.sync();
        expect(this.spies.doTasks.callCount).to.equal(1);
      });

      it("does not emit 'sync-started'", async function() {
        let syncStarted = false;
        this.rs.on("sync-started", () => { syncStarted = true; });
        await this.rs.sync.sync();
        expect(syncStarted).to.be.false;
      });
    });

    describe("with sync desired but not enough tasks queued", function() {
      beforeEach(function() {
        this.spies = {
          doTasks: sinon.stub(this.rs.sync, "doTasks").returns(false),
          collectTasks: sinon.spy(this.rs.sync, "collectTasks")
        };
      });

      it("calls #collectTasks()", async function() {
        await this.rs.sync.sync();
        expect(this.spies.collectTasks.callCount).to.equal(1);
      });

      it("calls #doTasks() twice", async function() {
        await this.rs.sync.sync();
        expect(this.spies.doTasks.callCount).to.equal(2);
      });

      it("does not emit 'sync-started'", async function() {
        let syncStarted = false;
        this.rs.on("sync-started", () => { syncStarted = true; });
        await this.rs.sync.sync();
        expect(syncStarted).to.be.false;
      });
    });

    describe("when the cache back-end is erroring", function() {
      beforeEach(function() {
        this.rs.sync.doTasks = () => false; // trigger collectTasks
        this.rs.local.forAllNodes = async function() {
          throw new Error("I am broken, deal with it!");
        };
      });

      it("rejects with error", async function() {
        await expect(this.rs.sync.sync()).to.eventually
          .be.rejectedWith(/cache unavailable/);
      });
    });
  });

  describe("#collectTasks", function() {
    beforeEach(function() {
      this.spies = {
        collectDiffTasks: sinon.spy(this.rs.sync, "collectDiffTasks"),
        collectRefreshTasks: sinon.spy(this.rs.sync, "collectRefreshTasks")
      };
    });

    describe("with tasks queued", function() {
      beforeEach(function() {
        this.rs.sync._tasks = { "/foo/bar": [] };
      });

      it("returns immediately", async function() {
        await this.rs.sync.collectTasks();
        expect(this.spies.collectDiffTasks.callCount).to.equal(0);
        expect(this.spies.collectRefreshTasks.callCount).to.equal(0);
      });
    });

    describe("when sync is stopped", function() {
      beforeEach(function() {
        this.rs.sync.stopped = true;
      });

      it("returns immediately", async function() {
        await this.rs.sync.collectTasks();
        expect(this.spies.collectDiffTasks.callCount).to.equal(0);
        expect(this.spies.collectRefreshTasks.callCount).to.equal(0);
      });
    });

    describe("with diffs found", function() {
      beforeEach(function() {
        sinon.restore();
        this.spies = {
          collectDiffTasks: sinon.stub(this.rs.sync, "collectDiffTasks").returns(1),
          collectRefreshTasks: sinon.spy(this.rs.sync, "collectRefreshTasks")
        };
      });

      it("calls #collectDiffTasks()", async function() {
        await this.rs.sync.collectTasks();
        expect(this.spies.collectDiffTasks.callCount).to.equal(1);
      });

      it("does not call #collectRefreshTasks()", async function() {
        await this.rs.sync.collectTasks();
        expect(this.spies.collectRefreshTasks.callCount).to.equal(0);
      });
    });

    describe("with no diffs found", function() {
      beforeEach(function() {
        sinon.restore();
        this.spies = {
          collectDiffTasks: sinon.stub(this.rs.sync, "collectDiffTasks").returns(0),
          collectRefreshTasks: sinon.spy(this.rs.sync, "collectRefreshTasks")
        };
      });

      it("calls #collectRefreshTasks()", async function() {
        await this.rs.sync.collectTasks();
        expect(this.spies.collectRefreshTasks.callCount).to.equal(1);
      });

      it("does not call #collectRefreshTasks() when `alsoCheckRefresh` is set to `false`", async function() {
        await this.rs.sync.collectTasks(false);
        expect(this.spies.collectRefreshTasks.callCount).to.equal(0);
      });
    });
  });

  describe("#collectRefreshTasks", function() {
    beforeEach(function() {
      this.fakeCallback = function() {};
      this.rs.sync.addTask(
        "/foo/bar/and/then/some", this.fakeCallback
      );
      this.rs.sync.now = () => 1234568654321;

      this.rs.local.forAllNodes = async function(cb) {
        cb({
          path: "/foo/bar/and/then/some", //should be overruled by ancestor /foo/ba/
          common: { body: "off", contentType: "cT", timestamp: 1234567890123 }
        });
        cb({
          path: "/foo/bar/", //should retrieve /foo/ to get its new revision
          common: { body: "off", contentType: "cT", timestamp: 1234567890124 }
        });
        cb({
          path: "/read/access/", // should retrieve
          common: { body: "off", contentType: "cT", timestamp: 1234567890124 }
        });
        cb({
          path: "/no/access/", // no access
          common: { body: "off", contentType: "cT", timestamp: 1234567890124 }
        });
      };

    });

    it("gives preference to parent folders", async function() {
      await this.rs.sync.collectRefreshTasks();

      expect(this.rs.sync._tasks).to.deep.equal({
        "/foo/": [this.fakeCallback], // inherited from task '/foo/bar/and/then/some'
        "/read/access/": []
      });
    });
  });

  describe("#collectDiffTasks", function() {
    beforeEach(function() {
    });

    describe("", function() {
      beforeEach(function() {
      });
    });


    it("does not enqueue tasks outside permitted access scopes", async function() {
      await this.rs.local.setNodes({
        "/foo/bar": {
          path: "/foo/bar",
          common: { body: "asdf", contentType: "qwer", revision: "987", timestamp: 1234567890123 },
          local: { body: false, timestamp: 1234567891000 }
        },
        "/public/nothings/bar": {
          path: "/public/nothings/bar",
          common: { revision: "987", timestamp: 1234567890123 },
          local: { body: "asdf", contentType: "qwer", timestamp: 1234567891000 }
        }
      });
      await this.rs.sync.collectDiffTasks();

      expect(this.rs.sync._tasks).to.deep.equal({
        "/foo/bar": []
      });
    });

    it("enqueues a task when a new remote revision has been set", async function() {
      await this.rs.local.setNodes({
        "/public/writings/bar": {
          path: "/public/writings/bar",
          common: { revision: "987", timestamp: 1234567890123 },
          remote: { revision: "a" }
        }
      });
      await this.rs.sync.collectDiffTasks();

      expect(this.rs.sync._tasks).to.deep.equal({
        "/public/writings/bar": []
      });
    });

    it("enqueues tasks for corrupt cache nodes with a readable path", async function() {
      await this.rs.local.setNodes({
        "/writings/baz": {
          // corrupt, but no path
          common: { body: "foo", contentType: "text/plain", revision: "123456abcdef", timestamp: 1234567890123 },
          remote: { revision: "yes" },
          push: "no"
        },
        "/writings/baf": {
          path: "/writings/baf",
          remote: { revision: "yes" }
        }
      });
      await this.rs.sync.collectDiffTasks();

      expect(this.rs.sync._tasks).to.deep.equal({
        "/writings/baf": []
      });
    });
  });

  describe("#doTasks", function() {
    beforeEach(function() {
      this.rs.sync.doTasks = this.original.doTasks;
    });

    describe("when not connected", function() {
      beforeEach(function() {
        this.rs.remote.connected = false;
        this.rs.sync._tasks = { "/foo1/": [] };
      });

      it("does not attempt any requests", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({ "/foo1/": [] });
        expect(Object.keys(this.rs.sync._running).length).to.equal(0);
      });
    });

    describe("when offline", function() {
      beforeEach(function() {
        this.rs.remote.connected = true;
        this.rs.remote.online = false;
        this.rs.sync.doTask = async function() {
          return { action: undefined, promise: Promise.resolve() };
        };
        this.rs.sync._tasks = {
          "/foo1/": [], "/foo2/": [], "/foo3": [], "/foo4/": [],
          "/foo/5": [], "/foo/6/": [], "/foo7/": [], "/foo8": []
        };
      });

      it("attempts only one request, at low frequency", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({
          "/foo1/": [], "/foo2/": [], "/foo3": [], "/foo4/": [],
          "/foo/5": [], "/foo/6/": [], "/foo7/": [], "/foo8": []
        });
        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          "/foo1/"
        ]);
      });
    });

    describe("normal operation", function() {
      beforeEach(function() {
        this.rs.remote.connected = true;
        this.rs.remote.online = true;
        this.rs.sync.numThreads = 5;

        this.rs.sync.doTask = async function() {
          return { action: undefined, promise: Promise.resolve() };
        };
        this.rs.sync._tasks = {
          "/foo1/": [], "/foo2/": [], "/foo3": [], "/foo4/": [],
          "/foo/5": [], "/foo/6/": [], "/foo7/": [], "/foo8": []
        };
      });

      it("emits 'sync-started'", function(done) {
        this.rs.on("sync-started", () => { done(); });
        this.rs.sync.doTasks();
      });

      it("attempts requests according to the number of threads configured", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({
          "/foo1/": [], "/foo2/": [], "/foo3": [], "/foo4/": [],
          "/foo/5": [], "/foo/6/": [], "/foo7/": [], "/foo8": [],
        });
        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          "/foo1/", "/foo2/", "/foo3", "/foo4/", "/foo/5"
        ]);
      });
    });
  });

  describe("#handleResponse", function() {
    describe("Fetching a new document", function() {
      describe("with no pending changes in parent folder", function() {
        beforeEach(async function() {
          await this.rs.local.setNodes({
            "/foo/": {
              path: "/foo/",
              common: {
                itemsMap: { "bar": true, "new": true },
                revision: "remotefolderrevision",
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: { "bar": true, "new": false },
                revision: "localfolderrevision",
                timestamp: 1397210425612
              }
            },
            "/foo/bar": {
              path: "/foo/bar",
              common: {
                body: { foo: "bar" },
                contentType: "application/json",
                revision: "docrevision",
                timestamp: 1234567891000
              }
            }
          });

          await this.rs.sync.handleResponse("/foo/new", "get", {
            statusCode: 200, body: { foo: "new" },
            contentType: "application/json",
            revision: "newrevision"
          });

          const nodes = await this.rs.local.getNodes(["/foo/"]);
          this.parentNode = nodes["/foo/"];
        });

        it("updates common itemsMap of parent folder", async function() {
          expect(this.parentNode.common.itemsMap).to.deep.equal({
            "bar": true, "new": true
          });
        });

        it("deletes local and remote itemsMap from parent folder", async function() {
          expect(this.parentNode.local).to.be.undefined;
          expect(this.parentNode.remote).to.be.undefined;
        });
      });

      describe("with other pending changes in parent folder", function() {
        beforeEach(async function() {
          await this.rs.local.setNodes({
            "/foo/": {
              path: "/foo/",
              common: {
                itemsMap: { "bar": true, "new": true, "othernew": true },
                revision: "remotefolderrevision",
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: { "bar": true, "new": false, "othernew": false },
                revision: "localfolderrevision",
                timestamp: 1397210425612
              }
            },
            "/foo/bar": {
              path: "/foo/bar",
              common: {
                body: { foo: "bar" },
                contentType: "application/json",
                revision: "docrevision",
                timestamp: 1234567891000
              }
            }
          });

          await this.rs.sync.handleResponse("/foo/new", "get", {
            statusCode: 200, body: { foo: "new" },
            contentType: "application/json",
            revision: "newrevision"
          });

          const nodes = await this.rs.local.getNodes(["/foo/"]);
          this.parentNode = nodes["/foo/"];
        });

        it("updates common itemsMap of parent folder", async function() {
          expect(this.parentNode.common.itemsMap).to.deep.equal({
            "bar": true, "new": true, "othernew": true
          });
        });

        it("keeps local itemsMap of parent folder", async function() {
          expect(this.parentNode.local.itemsMap).to.deep.equal({
            "bar": true, "new": true, "othernew": false
          });
        });

        it("deletes remote itemsMap from parent folder", async function() {
          expect(this.parentNode.remote).to.be.undefined;
        });
      });

      describe("called multiple times without waiting", function() {
        beforeEach(async function() {
          this.nodesFetched = [
            {
              path: "/foo/2", action: "get",
              response: {
                statusCode: 200, body: { foo: "new" },
                contentType: "application/json",
                revision: "newrevision2"
              },
            },
            {
              path: "/foo/3", action: "get",
              response: {
                statusCode: 200, body: { foo: "new" },
                contentType: "application/json",
                revision: "newrevision3"
              },
            }
          ];

          await this.rs.local.setNodes({
            "/foo/": {
              path: "/foo/",
              common: {
                itemsMap: { "1": false },
                revision: "remotefolderrevision",
                timestamp: 1397210425598,
              },
              local: {
                itemsMap: { "1": true },
                revision: "localfolderrevision",
                timestamp: 1397210425612
              }
            },
            "/foo/1": {
              path: "/foo/1",
              local: {
                body: { asdf: "asdf" },
                contentType: "application/json",
                timestamp: 1234567891000
              }
            }
          });

          const promises = [];
          for (const res of this.nodesFetched){
            promises.push(this.rs.sync.handleResponse(
              res.path, res.action, res.response
            ));
          }
          await Promise.all(promises);

          this.nodes = await this.rs.local.getNodes([
            "/foo/", "/foo/1", "/foo/2", "/foo/3"
          ]);
        });

        it("only updates local index for the latest change", function() {
          expect(this.nodes["/foo/"].local.itemsMap).to.deep.equal({
            "1": true, "3": true // does not include "2"
          });
        });

        it("caches the fetched nodes", function() {
          expect(this.nodes["/foo/2"]).to.be.an('object');
          expect(this.nodes["/foo/3"]).to.be.an('object');
        });
      });
    });

    describe("Document deleted on remote", function() {
      beforeEach(async function() {
        const newItemsMap = {
          "bar": { "ETag": "bardocrevision" },
          "new": { "ETag": "newdocrevision" }
        };

        this.rs.local.setNodes({
          "/foo/": {
            path: "/foo/",
            common: {
              itemsMap: { "bar": true, "old": true, },
              revision: "remotefolderrevision",
              timestamp: 1397210425598,
            },
            local: {
              itemsMap: { "bar": true, "old": true, "new": true },
              revision: "localfolderrevision",
              timestamp: 1397210425612
            }
          },
          "/foo/bar": {
            path: "/foo/bar",
            common: {
              body: { foo: "bar" },
              contentType: "application/json",
              revision: "bardocrevision",
              timestamp: 1234567891000
            }
          },
          "/foo/old": {
            path: "/foo/old",
            common: {
              body: { foo: "old" },
              contentType: "application/json",
              revision: "olddocrevision",
              timestamp: 1234567891000
            }
          },
          "/foo/new": {
            path: "/foo/new",
            local: {
              body: { foo: "new" },
              contentType: "application/json",
              timestamp: 1234567891000
            }
          }
        });

        await this.rs.sync.handleResponse('/foo/', 'get', {
          statusCode: 200, body: newItemsMap,
          contentType: 'application/json',
          revision: 'newfolderrevision'
        });

        this.nodes = await this.rs.local.getNodes([
          "/foo/", "/foo/old"
        ]);
      });

      it("removes the document from the parent node's common itemsMap", async function() {
        expect(this.nodes["/foo/"].common.itemsMap).to.deep.equal({
          "bar": true, "new": true
        });
      });

      it("removes the parent node's local and remote itemsMap", function() {
        expect(this.nodes["/foo/"].local).to.be.undefined;
        expect(this.nodes["/foo/"].remote).to.be.undefined;
      });

      it("removes the deleted node from the cache", function() {
        expect(this.nodes["/foo/old"]).to.be.undefined;
      });
    });

    describe("PUT without conflict", function() {
      beforeEach(async function() {
        this.rs.local.setNodes({
          "/foo/bar": {
            path: "/foo/bar",
            local: {
              body: { foo: "bar" },
              contentType: "application/json",
              timestamp: 1234567891000
            },
            push: {
              body: { foo: "bar" },
              contentType: "application/json",
              timestamp: 1234567891234
            }
          }
        });

        await this.rs.sync.handleResponse("/foo/bar", "put", {
          statusCode: 201, revision: "newrevision"
        });

        const nodes = await this.rs.local.getNodes(["/foo/bar"]);
        this.node = nodes["/foo/bar"];
      });

      it("updates 'common'", async function() {
        expect(this.node.common.body).to.deep.equal({foo: "bar"});
        expect(this.node.common.contentType).to.equal("application/json");
      });

      it("removes 'local' and 'push' from node", function() {
        expect(this.node.local).to.be.undefined;
        expect(this.node.push).to.be.undefined;
      });
    });

    describe("PUT with conflict", function() {
      beforeEach(async function() {
        this.rs.local.setNodes({
          "/foo/bar": {
            path: "/foo/bar",
            common: {
              body: "foo", contentType: "bloo",
              revision: "common"
            },
            local: { body: "floo", contentType: "blaloo" },
            push: { body: "floo", contentType: "blaloo" }
          }
        });

        this.rs.sync.now = function() { return 1234567890123; };

        await this.rs.sync.handleResponse("/foo/bar", "put", {
          statusCode: 412, revision: "updated-elsewhere"
        });

        const nodes = await this.rs.local.getNodes(["/foo/bar"]);
        this.node = nodes["/foo/bar"];
      });

      it("does not update local and known common data", function() {
        expect(this.node.common).to.deep.equal({
          body: "foo", contentType: "bloo", revision: "common"
        });
        expect(this.node.local).to.deep.equal({
          body: "floo", contentType: "blaloo"
        });
      });

      it("sets the remote revision and timestamp", function() {
        expect(this.node.remote).to.deep.equal({
          revision: "updated-elsewhere", timestamp: 1234567890123
        });
      });

      it("removes the node's push data", function() {
        expect(this.node.push).to.be.undefined;
      });
    });

    describe("401 response", function() {
      it("emits Unauthorized error", function(done) {
        this.rs.on("error", function(err) {
          if (err instanceof UnauthorizedError) { done(); }
        });

        this.rs.sync.handleResponse(
          undefined, undefined, { statusCode: 401 }
        );
      });
    });

    describe("Unknown response", function() {
      it("emits an error", function(done) {
        this.rs.on("error", function(err) {
          if (err instanceof Error) {
            expect(err.message).to.equal("HTTP response code 418 received.");
            done();
          }
        });

        this.rs.sync.handleResponse(
          undefined, undefined, { statusCode: 418 }
        );
      });
    });
  });

  describe("#autoMergeDocument", function() {
    describe("when remote only has a revision", function() {
      it("returns the node as is", function() {
        const node = {
          path: "foo",
          common: { body: "foo", contentType: "bloo", revision: "common" },
          local: { body: "floo", contentType: "blaloo" },
          remote: { revision: "updated-elsewhere" }
        };

        expect(this.rs.sync.autoMergeDocument(node)).to.equal(node);
      });
    });

    describe("on an empty node", function() {
      it("removes a remote version if it has a null revision", async function() {
        const node = {
          path: "foo", common: {}, remote: { revision: null }
        };

        expect(this.rs.sync.autoMergeDocument(node)).to
          .deep.equal({ path: "foo", common: {} });
      });
    });

    it("merges mutual deletions", function() {
      const node = {
        "path": "/myfavoritedrinks/b",
        "common": { "timestamp": 1405488508303 },
        "local":  { "body": false, "timestamp": 1405488515881 },
        "remote": { "body": false, "timestamp": 1405488740722 }
      };
      const localAndRemoteRemoved = {
        "path": "/myfavoritedrinks/b",
        "common": { "timestamp": 1405488508303 }
      };

      expect(this.rs.sync.autoMergeDocument(node)).to
        .deep.equal(localAndRemoteRemoved);
    });
  });

  describe.only("#autoMerge", function() {
    describe("new node", function() {
      beforeEach(function() {
        this.node = {
          path: "foo",
          common: {},
          remote: { body: "new value", contentType: "new content-type", revision: "remote" }
        };
      });

      it("emits a 'change' event", function(done) {
        this.rs.local.emitChange = function(changeEvent) {
          expect(changeEvent).to.deep.equal({
            origin: "remote",
            path: "foo",
            newValue: "new value",
            oldValue: undefined,
            newContentType: "new content-type",
            oldContentType: undefined
          });
          done();
        };

        this.rs.sync.autoMerge(this.node);
      });

      it("merges the node items", function() {
        expect(this.rs.sync.autoMerge(this.node)).to.deep.equal({
          path: "foo",
          common: { body: "new value", contentType: "new content-type", revision: "remote" }
        });
      });

      describe("with zero-length body", function() {
        beforeEach(function() {
          this.node = {
            path: "foo",
            common: {},
            remote: { body: "", contentType: "new content-type", revision: "remote" }
          };
        });

        it("emits a 'change' event", function(done) {
          this.rs.local.emitChange = function(changeEvent) {
            expect(changeEvent).to.deep.equal({
              origin: "remote",
              path: "foo",
              newValue: "",
              oldValue: undefined,
              newContentType: "new content-type",
              oldContentType: undefined
            });
            done();
          };

          this.rs.sync.autoMerge(this.node);
        });

        it("merges the node items", function() {
          expect(this.rs.sync.autoMerge(this.node)).to.deep.equal({
            path: "foo",
            common: { body: "", contentType: "new content-type", revision: "remote" }
          });
        });
      });
    });

    describe("updated node", function() {
      beforeEach(function() {
        this.node = {
          path: "foo",
          common: { body: "old value", contentType: "old content-type", revision: "common" },
          remote: { body: "new value", contentType: "new content-type", revision: "remote" }
        };
      });

      it("emits a 'change' event", function(done) {
        this.rs.local.emitChange = function(changeEvent) {
          expect(changeEvent).to.deep.equal({
            origin: "remote",
            path: "foo",
            newValue: "new value",
            oldValue: "old value",
            newContentType: "new content-type",
            oldContentType: "old content-type"
          });
          done();
        };

        this.rs.sync.autoMerge(this.node);
      });

      it("merges the node items", function() {
        expect(this.rs.sync.autoMerge(this.node)).to.deep.equal({
          path: "foo",
          common: { body: "new value", contentType: "new content-type", revision: "remote" }
        });
      });

      describe("with zero-length body", function() {
        beforeEach(function() {
          this.node = {
            path: "foo",
            common: { body: "old value", contentType: "old content-type", revision: "common" },
            remote: { body: "", contentType: "new content-type", revision: "remote" }
          };
        });

        it("emits a 'change' event", function(done) {
          this.rs.local.emitChange = function(changeEvent) {
            expect(changeEvent).to.deep.equal({
              origin: "remote",
              path: "foo",
              newValue: "",
              oldValue: "old value",
              newContentType: "new content-type",
              oldContentType: "old content-type"
            });
            done();
          };

          this.rs.sync.autoMerge(this.node);
        });

        it("merges the node items", function() {
          expect(this.rs.sync.autoMerge(this.node)).to.deep.equal({
            path: "foo",
            common: { body: "", contentType: "new content-type", revision: "remote" }
          });
        });
      });
    });

    describe("deleted node", function() {
      describe("with node cached before", function() {
        beforeEach(function() {
          this.node = {
            path: "foo",
            common: { body: "foo", contentType: "bloo", revision: "common" },
            remote: { body: false, revision: "null" }
          };
        });

        it("emits a change event", function(done) {
          this.rs.local.emitChange = function(changeEvent) {
            expect(changeEvent).to.deep.equal({
              origin: "remote",
              path: "foo",
              oldValue: "foo",
              newValue: undefined,
              oldContentType: "bloo",
              newContentType: undefined
            });
            done();
          };

          this.rs.sync.autoMerge(this.node);
        });

        it("returns undefined", function() {
          expect(this.rs.sync.autoMerge(this.node)).to.be.undefined;
        });
      });

      describe("with node not cached before", function() {
        beforeEach(function() {
          this.node = {
            path: "foo",
            common: {},
            remote: { body: false, revision: "null" }
          };
        });

        it("does not emit a change event", function() {
          const emitChange = sinon.spy(this.rs.local, "emitChange");

          this.rs.sync.autoMerge(this.node);

          expect(emitChange.called).to.be.false;
        });

        it("returns undefined", function() {
          expect(this.rs.sync.autoMerge(this.node)).to.be.undefined;
        });
      });
    });
  });

  describe("#markRemoteDeletions", function() {
    describe("with empty paths", function() {
      it("returns the changed nodes", async function() {
        const changedNodes = { changed: 'nodes' };
        const res = await this.rs.sync.markRemoteDeletions([], changedNodes);
        expect(res).to.equal(changedNodes);
      });
    });

    describe("with paths given", function() {
      it("returns undefined", async function() {
        const res = await this.rs.sync.markRemoteDeletions(['foo'], {});
        expect(res).to.be.undefined;
      });
    });
  });

  describe("#finishTask", function() {
    beforeEach(function() {
      this.tasks = {
        "/example/one": {
          "action": "get",
          "path": "/example/one",
          "promise": new Promise(resolve => {
            resolve({
              "statusCode": 200,
              "body": "one",
              "contentType": "text/plain; charset=UTF-8",
              "revision": "123456abcdef"
            });
          })
        },
        "/example/two": {
          "action": "get",
          "path": "/example/two",
          "promise": new Promise(resolve => {
            resolve({
              "statusCode": 200,
              "body": "two",
              "contentType": "text/plain; charset=UTF-8",
              "revision": "123456abcdef"
            });
          })
        },
        "/example/server-error": {
          "action": "get",
          "path": "/example/server-error",
          "promise": new Promise(resolve => {
            resolve({ "statusCode": 500 });
          })
        },
        "/example/timeout": {
          "action": "get",
          "path": "/example/timeout",
          "promise": new Promise(resolve => {
            resolve({ "statusCode": "timeout" });
          })
        }
      };

      Object.keys(this.tasks).map(path => {
        this.rs.sync._tasks[path] = [];
        this.rs.sync._timeStarted[path] = this.rs.sync.now();
        this.rs.sync._running[path] = Promise.resolve(this.tasks[path]);
      });
    });

    describe("successfully completed", function() {
      it("emits 'sync-req-done' with the number of remaining tasks", async function() {
        const rsEmit = sinon.spy(this.rs, "_emit");

        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(rsEmit.callCount).to.equal(1);
        expect(rsEmit.getCall(0).args[0]).to.equal("sync-req-done");
        expect(rsEmit.getCall(0).args[1]).to.have.property("tasksRemaining", 3);
      });

      it("removes the task from _running tasks", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          "/example/two", "/example/server-error", "/example/timeout"
        ]);
      });

      it("removes the task start time from _timeStarted", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._timeStarted)).to.not.include("/example/one");
      });

      it("removes the task from _running tasks", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          '/example/two', '/example/server-error', '/example/timeout'
        ]);
      });

      it("removes the task start time from _timeStarted", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._timeStarted)).to.not.include('/example/one');
      });

      describe("last task", function() {
        beforeEach(function() {
          this.rs.sync.collectTasks = async () => {};
          this.rs.sync._tasks = { "/example/one": this.tasks["/example/one"] };
        });

        it("marks the sync as done", async function() {
          await this.rs.sync.finishTask(this.tasks["/example/one"], false);
          expect(this.rs.sync.done).to.be.true;
        });

        it("emits 'sync-done' with positive 'completed' status", async function() {
          const rsEmit = sinon.spy(this.rs, '_emit');

          await this.rs.sync.finishTask(this.tasks["/example/one"], false);

          expect(rsEmit.callCount).to.equal(2);
          expect(rsEmit.getCall(1).args[0]).to.equal('sync-done');
          expect(rsEmit.getCall(1).args[1]).to.have.property('completed', true);
        });
      });
    });

    describe("failed to complete", function() {
      beforeEach(async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);
      });

      it("removes the task from _running tasks", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          '/example/two', '/example/server-error', '/example/timeout'
        ]);
      });

      it("removes the task start time from _timeStarted", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(Object.keys(this.rs.sync._timeStarted)).to.not.include('/example/one');
      });

      it("emits 'sync-req-done' with the number of remaining tasks", async function() {
        const rsEmit = sinon.spy(this.rs, '_emit');
        await this.rs.sync.finishTask(this.tasks["/example/server-error"], false);

        expect(rsEmit.callCount).to.equal(3); // 'error', 'sync-req-done', 'sync-done'
        expect(rsEmit.getCall(1).args[0]).to.equal('sync-req-done');
        expect(rsEmit.getCall(1).args[1]).to.have.property('tasksRemaining', 3);
      });

      it("marks the sync as done", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/server-error"], false);
        expect(this.rs.sync.done).to.be.true;
      });

      it("emits 'sync-done' with negative 'completed' status", async function() {
        const rsEmit = sinon.spy(this.rs, '_emit');
        await this.rs.sync.finishTask(this.tasks["/example/server-error"], false);

        expect(rsEmit.getCall(2).args[0]).to.equal('sync-done');
        expect(rsEmit.getCall(2).args[1]).to.have.property('completed', false);
      });

      it("stops the current task cycle on server error", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/server-error"], false);
        expect(Object.keys(this.rs.sync._tasks)).to.deep.equal([
          "/example/two",
          "/example/server-error",
          "/example/timeout"
        ]);
      });

      it("stops the current task cycle on timeout", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/one"], false);
        await this.rs.sync.finishTask(this.tasks["/example/timeout"], false);
        expect(Object.keys(this.rs.sync._tasks)).to.deep.equal([
          "/example/two",
          "/example/server-error",
          "/example/timeout"
        ]);
      });
    });
  });

  describe("#queueGetRequest", function() {
    describe("normal operation", function() {
      beforeEach(async function() {
        this.rs.remote.connected = true;
        this.rs.remote.online = true;
        this.rs.caching.enable("/foo/");
        this.rs.local.get = async function(path) {
          if (path === "/foo/one") { return "dummy response"; }
        };
        this.rs.sync.doTasks = function() {
          // Execute callback for our queued task
          this._tasks["/foo/one"][0]();
        }.bind(this.rs.sync);

      });

      it("adds a task for the path and resolves with local data when task is finished", async function() {
        const res = await this.rs.sync.queueGetRequest("/foo/one");
        expect(res).to.equal("dummy response");
      });
    });

    describe("when not connected", function() {
      beforeEach(function() {
        this.rs.remote.connected = false;
      });

      it("get with maxAge requirement is rejected", async function() {
        await expect(this.rs.sync.queueGetRequest("/example/one")).to
          .eventually.be.rejectedWith(/remote is not connected/);
      });
    });

    describe("when not connected", function() {
      beforeEach(function() {
        this.rs.remote.connected = true;
        this.rs.remote.online = false;
      });

      it("get with maxAge requirement is rejected", async function() {
        await expect(this.rs.sync.queueGetRequest("/example/one")).to
          .eventually.be.rejectedWith(/remote is not online/);
      });
    });
  });

  describe("Edge cases", function() {
    describe("Syncing multiple new documents in the same folder while there are local changes", function() {
      beforeEach(function(done) {
        this.rs.remote.connected = true;
        this.rs.remote.online = true;
        this.rs.sync.doTasks = this.original.doTasks;
        this.rs.sync.doTask = async function(path) {
          return {
            action: 'get',
            path,
            promise: Promise.resolve({
              statusCode: 200,
              body: path,
              contentType: 'text/plain',
              revision: path
            })
          };
        };
        this.rs.sync._tasks = {
          '/foo/2': [], '/foo/3': [], '/foo/4': [], '/foo/5': [],
          '/foo/6': [], '/foo/7': [], '/foo/8': [], '/foo/9': [],
          '/foo/10': [], '/foo/11': [],
        };
        this.rs.local.setNodes({
          '/foo/': {
            path: '/foo/',
            common: {
              itemsMap: { '1': true, },
              revision: 'remotefolderrevision',
              timestamp: 1397210425598,
            },
            local: {
              itemsMap: { '1': true },
              revision: 'localfolderrevision',
              timestamp: 1397210425612
            }
          },
          '/foo/1': {
            path: '/foo/1',
            local: { body: '/foo/1', contentType: 'test/plain', timestamp: 1234567891000 }
          }
        });

        this.rs.on('sync-done', () => done());
        this.rs.sync.doTasks();
      });

      it("merges the folder without missing any documents", async function() {
        const nodes = await this.rs.local.getNodes(['/foo/']);
        const node = nodes['/foo/'];
        expect(node.local.itemsMap).to.deep.equal({
          '1': true,
          '2': true,
          '3': true,
          '4': true,
          '5': true,
          '6': true,
          '7': true,
          '8': true,
          '9': true,
          '10': true,
          '11': true,
        });
      });
    });
  });
});
