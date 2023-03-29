import 'mocha';
import chai, {expect} from 'chai';
import sinon from 'sinon';
import RemoteStorage from "../../src/remotestorage";
import Sync from "../../src/sync";
import InMemoryStorage from "../../src/inmemorystorage";

let rs, tasks;

describe("Sync", () => {

  before(() => {
    rs = new RemoteStorage();
    rs.local = new InMemoryStorage();
    rs.sync = new Sync(rs);
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

    describe("successfully completed", () => {
      it("emits 'sync-req-done' with the number of remaining tasks", async () => {
        const eventHandler = evt => { expect(evt.tasksRemaining).to.equal(1); }
        rs.on('sync-req-done', eventHandler);
        await rs.sync.finishTask(tasks["/example/one"], false);
        rs.removeEventListener('sync-req-done', eventHandler);
        rs.stopSync();
      });
    });

    describe("failed to complete", () => {
      it("emits 'sync-req-done' with the number of remaining tasks", async () => {
        const eventHandler = evt => { expect(evt.tasksRemaining).to.equal(2); }
        rs.on('sync-req-done', eventHandler);
        await rs.sync.finishTask(tasks["/example/two"], false);
        rs.removeEventListener('sync-req-done', eventHandler);
        rs.stopSync();
      });
    });
  });

});
