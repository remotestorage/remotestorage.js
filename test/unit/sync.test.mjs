import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import InMemoryStorage from '../../build/inmemorystorage.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import { Sync } from '../../build/sync.js';
import FakeAccess from '../helpers/fake-access.mjs';

describe("Sync", function() {
  beforeEach(function(done) {
    this.original = {};
    this.rs = new RemoteStorage();
    Object.defineProperty(this.rs, 'access', {
      value: new FakeAccess(),
      writable: true,
      configurable: true
    });

    this.rs.on('features-loaded', () => {
      this.rs._handlers['connected'] = [];
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
      this.rs._emit('ready');
    });

    it("starts syncing on connect", function(done) {
      let startSyncCalled = 0;
      this.rs.startSync = () => {
        startSyncCalled++;
        if (startSyncCalled === 1) { done(); }
      };

      Sync._rs_init(this.rs);
      this.rs._emit('connected');
    });

    it("removes the 'connected' handler when it's called", function() {
      Sync._rs_init(this.rs);
      this.rs._emit('connected');
      expect(this.rs._handlers['connected'].length).to.equal(0);
    });

    it("doesn't interfere with custom 'connected' handlers", function(done) {
      this.rs.on('connected', done);
      Sync._rs_init(this.rs);
      this.rs._emit('connected');
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
        '/a': '/',
        '/a/': '/',
        '/a/b': '/a/',
        '/a/b/': '/a/',
        '/a/b/c': '/a/b/',
        '/a/b/c/': '/a/b/'
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
      this.rs.on('sync-started', () => { syncStarted = true; });
      this.rs.on('sync-done', () => { syncDone = true; });

      await this.rs.sync.sync().then(() => {
        expect(syncStarted).to.be.false;
        expect(syncDone).to.be.false;
      });
    });

    describe("with no need to sync", function() {
      beforeEach(function() {
        this.spies = {
          doTasks: sinon.stub(this.rs.sync, 'doTasks').returns(true),
          collectTasks: sinon.spy(this.rs.sync, 'collectTasks')
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
        this.rs.on('sync-started', () => { syncStarted = true; });
        await this.rs.sync.sync();
        expect(syncStarted).to.be.false;
      });
    });

    describe("with sync desired but not enough tasks queued", function() {
      beforeEach(function() {
        this.spies = {
          doTasks: sinon.stub(this.rs.sync, 'doTasks').returns(false),
          collectTasks: sinon.spy(this.rs.sync, 'collectTasks')
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
        this.rs.on('sync-started', () => { syncStarted = true; });
        await this.rs.sync.sync();
        expect(syncStarted).to.be.false;
      });
    });
  });

  describe("#collectTasks", function() {
    beforeEach(function() {
      this.spies = {
        collectDiffTasks: sinon.spy(this.rs.sync, 'collectDiffTasks'),
        collectRefreshTasks: sinon.spy(this.rs.sync, 'collectRefreshTasks')
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
          collectDiffTasks: sinon.stub(this.rs.sync, 'collectDiffTasks').returns(1),
          collectRefreshTasks: sinon.spy(this.rs.sync, 'collectRefreshTasks')
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
          collectDiffTasks: sinon.stub(this.rs.sync, 'collectDiffTasks').returns(0),
          collectRefreshTasks: sinon.spy(this.rs.sync, 'collectRefreshTasks')
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
        '/foo/bar/and/then/some', this.fakeCallback
      );
      this.rs.sync.now = () => 1234568654321;

      this.rs.local.forAllNodes = async function(cb) {
        cb({
          path: '/foo/bar/and/then/some', //should be overruled by ancestor /foo/ba/
          common: { body: 'off', contentType: 'cT', timestamp: 1234567890123 }
        });
        cb({
          path: '/foo/bar/', //should retrieve /foo/ to get its new revision
          common: { body: 'off', contentType: 'cT', timestamp: 1234567890124 }
        });
        cb({
          path: '/read/access/', // should retrieve
          common: { body: 'off', contentType: 'cT', timestamp: 1234567890124 }
        });
        cb({
          path: '/no/access/', // no access
          common: { body: 'off', contentType: 'cT', timestamp: 1234567890124 }
        });
      };

    });

    it("gives preference to parent folders", async function() {
      await this.rs.sync.collectRefreshTasks();

      expect(this.rs.sync._tasks).to.deep.equal({
        '/foo/': [this.fakeCallback], // inherited from task '/foo/bar/and/then/some'
        '/read/access/': []
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
        this.rs.sync._tasks = { '/foo1/': [] };
      });

      it("does not attempt any requests", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({ '/foo1/': [] });
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
          '/foo1/': [], '/foo2/': [], '/foo3': [], '/foo4/': [],
          '/foo/5': [], '/foo/6/': [], '/foo7/': [], '/foo8': []
        };
      });

      it("attempts only one request, at low frequency", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({
          '/foo1/': [], '/foo2/': [], '/foo3': [], '/foo4/': [],
          '/foo/5': [], '/foo/6/': [], '/foo7/': [], '/foo8': []
        });
        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          '/foo1/'
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
          '/foo1/': [], '/foo2/': [], '/foo3': [], '/foo4/': [],
          '/foo/5': [], '/foo/6/': [], '/foo7/': [], '/foo8': []
        };
      });

      it("emits 'sync-started'", async function(done) {
        this.rs.on('sync-started', () => { done(); });
        this.rs.sync.doTasks();
      });

      it("attempts requests according to the number of threads configured", async function() {
        this.rs.sync.doTasks();

        expect(this.rs.sync._tasks).to.deep.equal({
          '/foo1/': [], '/foo2/': [], '/foo3': [], '/foo4/': [],
          '/foo/5': [], '/foo/6/': [], '/foo7/': [], '/foo8': [],
        });
        expect(Object.keys(this.rs.sync._running)).to.deep.equal([
          '/foo1/', '/foo2/', '/foo3', '/foo4/', '/foo/5'
        ]);
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
            resolve({ "statusCode": 500 });
          })
        }
      };

      this.rs.sync._tasks = this.tasks;
    });

    describe("successfully completed", function() {
      it("emits 'sync-req-done' with the number of remaining tasks", async function() {
        const rsEmit = sinon.spy(this.rs, '_emit');

        await this.rs.sync.finishTask(this.tasks["/example/one"], false);

        expect(rsEmit.callCount).to.equal(1);
        expect(rsEmit.getCall(0).args[0]).to.equal('sync-req-done');
        expect(rsEmit.getCall(0).args[1]).to.have.property('tasksRemaining', 1);
      });

      describe("last task", function() {
        beforeEach(function() {
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
      it("emits 'sync-req-done' with the number of remaining tasks", async function() {
        const rsEmit = sinon.spy(this.rs, '_emit');

        await this.rs.sync.finishTask(this.tasks["/example/two"], false);

        expect(rsEmit.callCount).to.equal(3); // 'error', 'sync-req-done', 'sync-done'
        expect(rsEmit.getCall(1).args[0]).to.equal('sync-req-done');
        expect(rsEmit.getCall(1).args[1]).to.have.property('tasksRemaining', 2);
      });

      it("marks the sync as done", async function() {
        await this.rs.sync.finishTask(this.tasks["/example/two"], false);
        expect(this.rs.sync.done).to.be.true;
      });

      it("emits 'sync-done' with negative 'completed' status", async function() {
        const rsEmit = sinon.spy(this.rs, '_emit');

        await this.rs.sync.finishTask(this.tasks["/example/two"], false);

        expect(rsEmit.getCall(2).args[0]).to.equal('sync-done');
        expect(rsEmit.getCall(2).args[1]).to.have.property('completed', false);
      });
    });
  });

});
