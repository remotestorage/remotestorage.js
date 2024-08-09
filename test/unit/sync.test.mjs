import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import InMemoryStorage from '../../build/inmemorystorage.js';
import { RemoteStorage } from '../../build/remotestorage.js';
import { Sync } from '../../build/sync.js';

describe("Sync", function() {
  const sandbox = sinon.createSandbox();

  beforeEach(function(done) {
    this.rs = new RemoteStorage();
    this.rs.on('features-loaded', () => {
      this.rs.local = new InMemoryStorage();
      this.rs.sync = new Sync(this.rs);
      this.rs.sync.doTasks = () => { return true; };
      done();
    });
  });

  afterEach(function() {
    sandbox.restore();
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
