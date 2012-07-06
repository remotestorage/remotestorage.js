(function() {
  describe("webfinger", function() {
    it("should look up a user", function() {
      var webfinger = specHelper.getFile('webfinger');
      var platformStub = specHelper.getPlatformStub('webfinger');
      var ret = webfinger.getStorageInfo('a@b.c', {}, function(err, data) {
        alert(err);
        alert(data);
      });
      expect(typeof(rit)).toEqual('undefined');
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(1);
      expect(calls[0].name).toEqual('ajax');
      expect(calls[0].params[0].url).toEqual('https://b.c/.well-known/host-meta');
      expect(typeof(calls[0].params[0].success)).toEqual('function');
      expect(typeof(calls[0].params[0].error)).toEqual('function');
      expect(typeof(calls[0].params[0].timeout)).toEqual('undefined');
    });
  });
})();
