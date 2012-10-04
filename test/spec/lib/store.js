
/**

   TODO:
   - getNodeData JSON parsing
   - setNodeData everything
   - clearDiff

 */

(function() {

  describe('store', function() {

    var store;

    beforeEach(function() {
      store = specHelper.getFile('store');      
    });

    describe('on', function() {

      it("allows to attach a 'change' event", function() {
        expect(function() {
          store.on('change', function() {});
        }).not.toThrow();
      });

      it("throws an error, if an invalid eventName is given", function() {
        expect(function() {
          store.on('invalid-event-name', function() {});
        }).toThrow();
      });

    });
    
    describe('getNode', function() {
      var result, nodeObj = JSON.stringify({
        startAccess: null,
        startForce: null,
        lastModified: 10,
        outgoingChange: false,
        mimeType: "application/json",
        keep: true,
        added: {},
        removed: {},
        changed: {}
      }), lsSpy;

      beforeEach(function() {
        lsSpy = spyOn(Storage.prototype, 'getItem').andReturn(nodeObj);
        spyOn(JSON, 'parse').andCallThrough();

        result = store.getNode('/path/to/node');
      });

      it('gets the value from localStorage, with a key prefix', function() {
        expect(localStorage.getItem).toHaveBeenCalledWith(
          'remote_storage_nodes:/path/to/node'
        );
      });

      it('parses the JSON fetched json data', function() {
        expect(JSON.parse).toHaveBeenCalledWith(nodeObj);
      });

      it('returns the parsed object', function() {
        expect(typeof(result)).toEqual('object');
        expect(result.keep).toEqual(true);
        expect(result.lastModified).toEqual(10);
      });

      describe('if invalid json data is retrieved', function() {

        beforeEach(function() {
          lsSpy.plan = function() {
            return "{this:'will',!!!FAIL...{'";
          }
        });

        it("doesn't throw an exception", function() {
          expect(function() { store.getNode('/path/to/node'); }).
            not.toThrow();
        });

        it("still returns an object", function() {
          expect(typeof(store.getNode('/path/to/node'))).toEqual('object');
        });
      });

      describe('the newly created node', function() {

        beforeEach(function() {
          lsSpy.plan = function() {
            return undefined;
          }

          result = store.getNode('/path/to/node');
        });

        it('has all the right attributes', function() {
          expect(
            Object.keys(result).sort()
          ).toEqual(
            ['diff', 'keep', 'mimeType', 'startAccess', 'startForce', 'timestamp']
          );
        });
        
      });

    });


    describe('getNodeData', function() {

      it("returns undefined for data nodes that don't exist", function() {
        expect(store.getNodeData('/unexistant/node')).toBe(undefined);
      });

    });
    
    xdescribe('setNodeData', function() {

    });
    
    describe('setNodeAccess', function() {

      it("sets the node's startAccess flag to the given claim", function() {
        store.setNodeAccess('/foo/bar', 'rw');
        expect(store.getNode('/foo/bar').startAccess).toEqual('rw');
      });
      
    });
    
    describe('setNodeForce', function() {

      it("sets the node's startForce flag to the given value", function() {
        store.setNodeForce('/foo/bar', true);
        expect(store.getNode('/foo/bar').startForce).toBe(true);
        store.setNodeForce('/foo/baz', false);
        expect(store.getNode('/foo/baz').startForce).toBe(false);
      });

    });
    
    describe('forget', function() {

      beforeEach(function() {
        store.setNodeAccess('/foo/bar', 'rw');
        // check that it worked...
        expect(store.getNode('/foo/bar').startAccess).toEqual('rw');
      });

      it("removes the node at given path from local storage", function() {
        store.forget('/foo/bar');
        expect(store.getNode('/foo/bar').startAccess).toBe(null);
      });

    });
    
    describe('forgetAll', function() {

      beforeEach(function() {
        store.setNodeAccess('/foo/bar', 'rw');
        store.setNodeData('/foo/bar', 'baz');
        store.setNodeAccess('/foo/baz', 'r');
        store.setNodeData('/foo/baz', 'bar');
      });

      it("removes all node metadata", function() {
        store.forgetAll();
        expect(store.getNode('/foo/bar').startAccess).toBe(null);
        expect(store.getNode('/foo/baz').startAccess).toBe(null);
      });

      it("removes all node data", function() {
        store.forgetAll();
        expect(store.getNodeData('/foo/bar')).toBe(undefined);
        expect(store.getNodeData('/foo/baz')).toBe(undefined);
      });

    });

  });

})();
