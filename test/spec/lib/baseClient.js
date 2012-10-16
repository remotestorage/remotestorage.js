
(function() {

  describe('BaseClient', function() {
    var BaseClient, baseClient, storeStub, client, storeChangeHandler;

    beforeEach(function() {
      storeStub = specHelper.getStub('baseClient', 'store', false);
      BaseClient = specHelper.getFile('baseClient');
      baseClient = new BaseClient('test');

      storeStub.getCalled().forEach(function(call) {
        if(call.name === 'on' && call.params[0] === 'change') {
          storeChangeHandler = call.params[1];
        }
      });
    });

    it("is listening for store change events", function() {
      expect(storeChangeHandler).not.toBe(undefined);
      expect(typeof storeChangeHandler).toEqual('function');
    });

    describe('on', function() {

      describe("change event", function() {
        var called;

        beforeEach(function() {
          called = [];
          baseClient.on("change", function() {
            called.push(Array.prototype.slice.call(arguments));
          });
        });

        it("gets fired, when there is a change event from store", function() {
          var evt = {
            path: "/test/foo/bar",
            oldValue: "foo",
            newValue: "bar",
            origin: "window"
          };
          storeChangeHandler(evt);
          expect(called.length).toEqual(1);
          expect(called[0]).toEqual([evt]);
        });

        it("gets fired, when data is being updated", function() {
          baseClient.storeObject('test-object', 'foo/bar', {
            value: 'baz'
          });
          expect(called.length).toEqual(1);
          var evt = called[0][0];
          console.log("EVT", evt);
          expect(evt.path).toEqual('foo/bar');
          expect(evt.oldValue).toBe(undefined);
          expect(typeof(evt.newValue)).toEqual('object');
          expect(evt.newValue.value).toEqual('baz');
          expect(evt.origin).toEqual("window");
        });

      });

    });

    describe('getObject', function() {});
    describe('getListing', function() {});
    describe('getDocument', function() {});
    describe('remove', function() {});
    describe('storeObject', function() {});
    describe('storeDocument', function() {});
    describe('getItemURL', function() {});
    describe('sync', function() {});
    describe('syncNow', function() {});

  });

})();
