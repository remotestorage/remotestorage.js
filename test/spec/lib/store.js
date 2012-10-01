
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
      var result, nodeData = JSON.stringify({
        startAccess: null,
        startForce: null,
        lastModified: 10,
        outgoingChange: false,
        keep: true,
        added: {},
        removed: {},
        changed: {}
      }), lsSpy;

      beforeEach(function() {
        lsSpy = spyOn(Storage.prototype, 'getItem').andReturn(nodeData);
        spyOn(JSON, 'parse').andCallThrough();

        result = store.getNode('path/to/node');
      });

      it('gets the value from localStorage, with a key prefix', function() {
        expect(localStorage.getItem).toHaveBeenCalledWith(
          'remote_storage_nodes:path/to/node'
        );
      });

      it('parses the JSON fetched json data', function() {
        expect(JSON.parse).toHaveBeenCalledWith(nodeData);
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
          expect(function() { store.getNode('path/to/node'); }).
            not.toThrow();
        });

        it("still returns an object", function() {
          expect(typeof(store.getNode('path/to/node'))).toEqual('object');
        });
      });

      describe('the newly created node', function() {

        beforeEach(function() {
          lsSpy.plan = function() {
            return undefined;
          }

          result = store.getNode('path/to/node');
        });

        it('has all the right attributes', function() {
          expect(
            Object.keys(result).sort()
          ).toEqual(
            ['diff', 'keep', 'startAccess', 'startForce', 'timestamp']
          );
        });
        
      });

    });


    xdescribe('getNodeData', function() {
    });
    
    xdescribe('setNodeData', function() {
    });
    
    xdescribe('setNodeAccess', function() {
    });
    
    xdescribe('setNodeForce', function() {
    });
    
    xdescribe('clearOutgoingChange', function() {
    });
    
    xdescribe('forget', function() {
    });
    
    xdescribe('forgetAll', function() {
    });

  });

})();
