import 'mocha';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import RemoteStorage from "../../src/remotestorage";
import Sync from "../../src/sync";
import InMemoryStorage from "../../src/inmemorystorage";

let rs, tasks;

describe("Sync", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    rs = new RemoteStorage();
    rs.local = new InMemoryStorage();
    rs.sync = new Sync(rs);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#finishTask", () => {
    beforeEach(() => {
      tasks = {
        "/example/one": {
          "action": "get",
          "path": "/example/one",
          "promise": new Promise((resolve, reject) => {
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
          "promise": new Promise((resolve, reject) => {
            resolve({ "statusCode": 500 });
          })
        }
      }
      rs.sync._tasks = tasks;
      rs.sync.doTasks = () => { return; }
    });

    afterEach(() => {
      rs.stopSync();
    })

    describe("successfully completed", () => {
      it("emits 'sync-req-done' with the number of remaining tasks", async () => {
        const rsEmit = sinon.spy(rs, '_emit');

        await rs.sync.finishTask(tasks["/example/one"], false);

        expect(rsEmit.callCount).to.equal(1);
        expect(rsEmit.getCall(0).args[0]).to.equal('sync-req-done');
        expect(rsEmit.getCall(0).args[1]).to.have.property('tasksRemaining', 1);
      });

      describe("last task", () => {
        beforeEach(() => {
          rs.sync._tasks = { "/example/one": tasks["/example/one"] }
        });

        it("marks the sync as done", async () => {
          await rs.sync.finishTask(tasks["/example/one"], false);
          expect(rs.sync.done).to.be.true;
        });

        it("emits 'sync-done' with positive 'completed' status", async () => {
          const rsEmit = sinon.spy(rs, '_emit');

          await rs.sync.finishTask(tasks["/example/one"], false);

          expect(rsEmit.callCount).to.equal(2);
          expect(rsEmit.getCall(1).args[0]).to.equal('sync-done');
          expect(rsEmit.getCall(1).args[1]).to.have.property('completed', true);
        });
      });
    });

    describe("failed to complete", () => {
      it("emits 'sync-req-done' with the number of remaining tasks", async () => {
        const rsEmit = sinon.spy(rs, '_emit');

        await rs.sync.finishTask(tasks["/example/two"], false);

        expect(rsEmit.callCount).to.equal(3); // 'error', 'sync-req-done', 'sync-done'
        expect(rsEmit.getCall(1).args[0]).to.equal('sync-req-done');
        expect(rsEmit.getCall(1).args[1]).to.have.property('tasksRemaining', 2);
      });

      it("marks the sync as done", async () => {
        await rs.sync.finishTask(tasks["/example/two"], false);
        expect(rs.sync.done).to.be.true;
      });

      it("emits 'sync-done' with negative 'completed' status", async () => {
        const rsEmit = sinon.spy(rs, '_emit');

        await rs.sync.finishTask(tasks["/example/two"], false);

        expect(rsEmit.getCall(2).args[0]).to.equal('sync-done');
        expect(rsEmit.getCall(2).args[1]).to.have.property('completed', false);
      });
    });
  });

});
