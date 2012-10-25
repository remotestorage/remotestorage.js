
interceptDependencies(1);

define(['remotestorage/lib/store'], function(store) {

  var dependencies = resetDependencies();
  var util = dependencies[0];

  var firedChanges = [];

  beforeEach(function() {
    localStorage.clear();

    firedChanges = [];
    store.events.reset();
    store.on('change', function(event) {
      firedChanges.push(event);
    });
  });

  var initialTime      = 1234567890;
  var localUpdateTime  = 2345678901;
  var remoteUpdateTime = 3456789012;
  
  describe("getNode", function() {

    var result;

    describe("with path to non-existant data node", function() {

      beforeEach(function() {
        result = store.getNode('/path/that/doesnt/exist');
      });

      it("has timestamp and lastUpdatedAt set to 0", function() {
        expect(result.timestamp).toEqual(0);
        expect(result.lastUpdatedAt).toEqual(0);
      });

      it("has a default mime type of application/json", function() {
        expect(result.mimeType).toEqual('application/json');
      });

      it("has force and access flags set to null", function() {
        expect(result.startAccess).toEqual(null);
        expect(result.startForce).toEqual(null);
        expect(result.startForceTree).toEqual(null);
      });

      it("has no diff", function() {
        expect(result.diff).toBe(undefined);
      });

    });

    describe("with path to non-existant directory node", function() {

      beforeEach(function() {
        result = store.getNode('/path/that/doesnt/exist/');
      });

      it("has an empty diff set", function() {
        expect(result.diff).not.toBe(undefined);
        expect(typeof(result.diff)).toEqual('object');
        expect(Object.keys(result.diff).length).toEqual(0);
      });
      
    });

    describe("with path to an existing data node", function() {
      var result;

      beforeEach(function() {
        store.setNodeData(
          '/path/that/does/exist', "DATA", false, initialTime, 'text/plain'
        );

        result = store.getNode('/path/that/does/exist');
      });

      it("has the correct mime type set", function() {
        expect(result.mimeType).toEqual('text/plain');
      });

      it("still has no access or force flags set", function() {
        expect(result.startAccess).toEqual(null);
        expect(result.startForce).toEqual(null);
        expect(result.startForceTree).toEqual(null);
      });

      it("has the correct timestamp set", function() {
        expect(result.timestamp).toEqual(initialTime);
      });

    });

  });

  describe("getNodeData", function() {
    describe("for non-existant data node", function() {
      var result;
      
      beforeEach(function() {
        result = store.getNodeData('/path/that/doesnt/exist');
      });

      it("returns undefined", function() {
        expect(result).toBe(undefined);
      });
      
    });

    describe("for non-existant directory node", function() {
      beforeEach(function() {
        result = store.getNodeData('/path/that/doesnt/exist/');
      });

      it("returns undefined", function() {
        expect(result).toBe(undefined);
      });

    });
  });

  describe("setNodeData", function() {

    var path, data;

    describe("incoming", function() {
      beforeEach(function() {
        path = '/incoming/data';
        data = 'foo';
        store.setNodeData(path, data, false, remoteUpdateTime, 'text/plain');
      });

      it("updates the node's timestamp", function() {
        expect(store.getNode(path).timestamp).toEqual(remoteUpdateTime);
      });

      it("updates the node's lastUpdatedAt", function() {
        expect(store.getNode(path).lastUpdatedAt).toEqual(remoteUpdateTime);
      });

      it("updates the node's mimeType", function() {
        expect(store.getNode(path).mimeType).toEqual('text/plain');
      });

      it("updates the node's data", function() {
        expect(store.getNodeData(path)).toEqual(data);
      });
      
      it("doesn't set a diff on the parent", function () {
        expect(Object.keys(store.getNode(util.containingDir(path)).diff).length).toEqual(0)
      });

      it("fires a 'change' event", function() {
        expect(firedChanges.length).toEqual(1);
        var event = firedChanges[0];
        expect(event.origin).toEqual('remote');
        expect(event.timestamp).toEqual(remoteUpdateTime);
        expect(event.oldValue).toEqual(undefined);
        expect(event.newValue).toEqual(data);
        expect(event.path).toEqual(path);
      });
    });

    describe("incoming, without timestamp", function() {
      it("throws an exception", function() {
        expect(function() {
          store.setNodeData('/foo/bar', 'foobar', false);
        }).toThrow();
      });
    });

    describe("outgoing", function() {
      beforeEach(function() {
        path = '/outgoing/data';
        data = 'bar';
        store.setNodeData(path, data, true, localUpdateTime, 'text/plain');
      });

      it("updates the node's timestamp", function() {
        expect(store.getNode(path).timestamp).toEqual(localUpdateTime);
      });

      it("doesn't update the node's lastUpdatedAt", function() {
        expect(store.getNode(path).lastUpdatedAt).toEqual(0);
      });

      it("updates the node's mimeType", function() {
        expect(store.getNode(path).mimeType).toEqual('text/plain');
      });

      it("updates the node's data", function() {
        expect(store.getNodeData(path)).toEqual(data);
      });

      it("updates all parents' listing", function() {
        expect(store.getNodeData('/outgoing/')['data']).toEqual(localUpdateTime);
        expect(store.getNodeData('/')['outgoing/']).toEqual(localUpdateTime);
      });
      
      it("sets a diff on all parents", function () {
        var parent = store.getNode('/outgoing/');
        expect(parent.diff['data']).toEqual(localUpdateTime);
        var root = store.getNode('/');
        expect(root.diff['outgoing/']).toEqual(localUpdateTime);
      });

      it("updates the timestamp of the parents", function() {
        var parent = store.getNode('/outgoing/');
        expect(parent.timestamp).toEqual(localUpdateTime);
        var root = store.getNode('/');
        expect(root.timestamp).toEqual(localUpdateTime);
      });

      it("fires no 'change' event", function() {
        expect(firedChanges.length).toEqual(0);
      });
    });

    describe("outgoing, with no data set", function() {
      beforeEach(function() {
        store.setNodeData('/incoming/data', 'foobarbaz', false, initialTime, 'text/plain');

        store.setNodeData('/incoming/data', undefined, true, localUpdateTime);
      });

      it("sets the correct timestamp on the parents", function() {
        var parent = store.getNode('/incoming/');
        expect(parent.timestamp).toEqual(localUpdateTime);
        var root = store.getNode('/');
        expect(root.timestamp).toEqual(localUpdateTime);
      });

      it("sets a diff on all parents", function() {
        var parent = store.getNode('/incoming/');
        expect(parent.diff['data']).toEqual(localUpdateTime);
        var root = store.getNode('/');
        expect(root.diff['incoming/']).toEqual(localUpdateTime);
      });

      it("clears the data", function() {
        expect(store.getNodeData('/incoming/data')).toBe(undefined);
      });
    });

  });

  describe("clearDiff", function() {

    describe("with path to an updated data node", function() {

      beforeEach(function() {
        store.setNodeData('/outgoing/data', 'foobarbaz', true, localUpdateTime, 'text/plain');

        store.clearDiff('/outgoing/data');
      });

      it("clears the diff on all parents", function() {
        expect(Object.keys(store.getNode('/outgoing/').diff).length).toEqual(0);
        expect(Object.keys(store.getNode('/').diff).length).toEqual(0);
      });

    });

    describe("with path to a deleted data node", function() {
      beforeEach(function() {
        store.setNodeData('/incoming/data', 'foobarbaz', false, initialTime, 'text/plain');
        store.setNodeData('/incoming/data', undefined, true, localUpdateTime);
        
        store.clearDiff('/incoming/data');
      });

      it("removes all empty parents", function() {
        expect(store.getNodeData('/incoming/')).toBe(undefined);
        expect(store.getNodeData('/')).toBe(undefined);
      });
      
    });

  });

  describe("removeNode", function() {
  });

  xdescribe("setNodeError");

  xdescribe("on");

  xdescribe("setNodeAccess");

  xdescribe("setNodeForce");

  xdescribe("forget");

  xdescribe("forgetAll");

  xdescribe("fireInitialEvents");

  jasmineEnv.execute();

});
