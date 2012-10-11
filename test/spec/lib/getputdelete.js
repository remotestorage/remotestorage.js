
(function() {

  describe('getputdelete', function() {
    var getputdelete, platform, util;
    
    beforeEach(function() {
      getputdelete = specHelper.getFile('getputdelete');
      platform = specHelper.getStub('getputdelete', 'platform');
      util = specHelper.getStub('getputdelete', 'util');
    });

    var args, result, ajaxOpts, testedMethod;

    function checkAjaxCall(method) {
      it('sends a ' + method + ' request', function() {
        expect(ajaxOpts.method).toEqual(method);
      });

      it('sets the correct Authorization header', function() {
        expect(ajaxOpts.headers['Authorization']).
          toEqual('Bearer bearer-token');
      });

      it('requests the correct path', function() {
        expect(ajaxOpts.url).toEqual('/given/path');
      });

      it('is given success and error callbacks', function() {
        expect(typeof(ajaxOpts.success)).toEqual('function');
        expect(typeof(ajaxOpts.error)).toEqual('function');
      });
    }

    function callAndGetAjaxCall() {
      getputdelete[testedMethod].apply(getputdelete, args);

      var ajaxCall = platform.getCalled()[0];
      expect(ajaxCall).not.toBe(undefined);
      expect(ajaxCall.name).toEqual('ajax');
      ajaxOpts = ajaxCall.params[0];
    }

    describe('get', function() {

      beforeEach(function() {
        testedMethod = 'get';
        args = ['/given/path', 'bearer-token', function() {
          result = Array.prototype.slice.call(arguments);
        }];
      });

      describe('the ajax call', function() {
        beforeEach(callAndGetAjaxCall);
        checkAjaxCall('GET');
      });

      describe('error handling', function() {
        beforeEach(callAndGetAjaxCall);

        it("propagates the error message", function() {
          ajaxOpts.error('my-error');
          expect(result[0]).toEqual('my-error');
        });

        it("treats 404 errors as undefined values", function() {
          ajaxOpts.error(404);
          expect(result[0]).toBe(null);
          expect(result[1]).toBe(undefined);
        });

        it("passes on data and mimetype when success() is called", function() {
          ajaxOpts.success("something", { 'content-type': 'text/plain' });
          expect(result[1]).toEqual('something');
          expect(result[2]).toEqual('text/plain');
        });

        it("defaults the mime type to application/octet-stream", function() {
          ajaxOpts.success("something-else", {});
          expect(result[1]).toEqual('something-else');
          expect(result[2]).toEqual('application/octet-stream');
        });
      });

      describe("GET on directories", function() {
        beforeEach(function() {
          args[0] += '/';
          callAndGetAjaxCall();
        });

        it("still passes on the correct path", function() {
          expect(ajaxOpts.url).toEqual('/given/path/');
        });

        it("attempts to parse the response from JSON", function() {
          ajaxOpts.success('{"foo":123,"bar/":456}', { 'content-type' : 'application/json'});
          expect(typeof(result[1])).toEqual('object');
        });

        it("yields an error, when parsing the response fails", function() {
          ajaxOpts.success('this aint json', { 'content-type' : 'application/json'});
          expect(typeof(result[0])).toEqual('string');
        });
      });

    });

    describe('set', function() {

      beforeEach(function() {
        testedMethod = 'set';
        args = ['/given/path', 'value', 'text/plain', 'bearer-token',
                function() { result = Array.prototype.slice.call(arguments); }];
      });

      describe('the ajax call, when a value is present', function() {
        beforeEach(callAndGetAjaxCall);

        checkAjaxCall('PUT');

        it('sets the data to the given value', function() {
          expect(ajaxOpts.data).toEqual('value');
        });
      });

      describe('the ajax call, when no value is present', function() {
        beforeEach(function() {
          args[1] = undefined;
          callAndGetAjaxCall();
        });

        checkAjaxCall('DELETE');
      });

    });

  });

})();
