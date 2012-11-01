
interceptDependencies(1);

define(['remotestorage/lib/baseClient'], function(BaseClient) {

  var dependencies = resetDependencies();
  var sync = dependencies[0];
  var store = dependencies[1];
  var util = dependencies[2];
  var validate = dependencies[3];
  var wireClient = dependencies[4];

  describe('BaseClient', function() {

    var instance;

    beforeEach(function() {
      instance = new BaseClient('test');
    });

    describe('constructor', function() {

      it('sets the moduleName', function() {
        expect(instance.moduleName).toEqual('test');
      });

      it('throws an exception, when moduleName is not given', function() {
        expect(function() { new BaseClient; }).toThrow();
      });

      it('sets up an event emitter', function() {
        expect(typeof(instance.events)).toEqual('object');
        expect(typeof(instance.events.on)).toEqual('function');
      });

      it("binds all it's methods to the instance", function() {
        var makePath = instance.makePath;
        expect(makePath('foo/bar/baz')).toEqual(instance.makePath('foo/bar/baz'));
      });
    });

    describe('makePath', function() {
      it('generates the correct path', function() {
        expect(instance.makePath('foo/bar')).toEqual('/test/foo/bar');
      });

      it('works correctly for public clients', function() {
        instance = new BaseClient('test', true);
        expect(instance.makePath('foo/bar')).toEqual('/public/test/foo/bar');
      });

      it('works correctly for the root client', function() {
        instance = new BaseClient('root');
        expect(instance.makePath('foo/bar')).toEqual('/foo/bar');
        expect(instance.makePath('/foo/bar')).toEqual('/foo/bar');
      });

      it('works correctly for the root client in public mode', function() {
        instance = new BaseClient('root', true);
        expect(instance.makePath('foo/bar')).toEqual('/public/foo/bar');
        expect(instance.makePath('/foo/bar')).toEqual('/public/foo/bar');
      });
    });

    describe('lastUpdateOf', function() {
      var node = null;

      beforeEach(function() {
        spyOn(store, 'getNode').andCallFake(function() {
          return node;
        });
      });

      it("fetches a node", function() {
        instance.lastUpdateOf('foo/bar');
        expect(store.getNode).toHaveBeenCalledWith('/test/foo/bar');
      });

      it("returns null if there is no node", function() {
        expect(instance.lastUpdateOf('foo/bar')).toBe(null);
      });

      it("returns the node's timestamp, if it is set", function() {
        node = { timestamp: 12345 };
        expect(instance.lastUpdateOf('foo/bar')).toEqual(12345);
      });
    });

    describe("on", function() {
      it("forwards to the event emitter", function() {
        spyOn(instance.events, 'on');
        instance.on('change', function() {});
        expect(instance.events.on).toHaveBeenCalledWith(
          'change', jasmine.any(Function)
        );
      });

      it("knows 'change' events", function() {
        expect(function() {
          instance.on('change', function() {});
        }).not.toThrow();
      });

      it("knows 'change' events", function() {
        expect(function() {
          instance.on('change', function() {});
        }).not.toThrow();
      });

      it("knows 'conflict' events", function() {
        expect(function() {
          instance.on('conflict', function() {});
        }).not.toThrow();
      });
    });

    describe("getObject", function() {
      var nodeData;
      var syncOneCbArgs;
      
      beforeEach(function() {
        nodeData = undefined;
        syncOneCbArgs = undefined;
        spyOn(store, 'getNodeData').andCallFake(function() {
          return nodeData;
        });
        spyOn(sync, 'syncOne').andCallFake(function(path, cb) {
          if(syncOneCbArgs) cb.apply(null, syncOneCbArgs);
        });
      });

      it("loads the node data from store and returns it", function() {
        nodeData = 'adsf';
        var result = instance.getObject('foo/baz');
        expect(store.getNodeData).toHaveBeenCalledWith('/test/foo/baz');
        expect(result).toEqual(nodeData);
      });

      describe("with a callback given", function() {
        var cb = function() { cb.calls.push(util.toArray(arguments)) };
        beforeEach(function() {
          cb.calls = [];
        });

        it("calls the callback with the data received by the store", function() {
          nodeData = 'blablubb';
          instance.getObject('foo/bar', cb);
          expect(cb.calls.length).toEqual(1);
          expect(cb.calls[0][0]).toEqual(nodeData);
        });

        it("calls sync.syncOne when there is no data in the store", function() {
          instance.getObject('foo/bar', cb);
          expect(sync.syncOne).toHaveBeenCalledWith(
            '/test/foo/bar', jasmine.any(Function)
          );
        });

        it("calls the callback with the data returned by syncOne", function() {
          syncOneCbArgs = [{}, 'blabla'];
          instance.getObject('foo/bar', cb);
          expect(cb.calls[0][0]).toEqual('blabla');
        });
      });
    });
  });

  jasmineEnv.execute();

});
