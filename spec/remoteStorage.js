require(['./test/remoteStorage'], function(remoteStorage){
  describe("webfinger functions", function() {
    it("should fail to parse a bogus host-meta", function() {
      ajaxResponses = [{
        success: true,
        data: 'asdf'
      }];
      ajaxCalls = [];
      remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
        expect(err).toEqual('JSON parsing failed - asdf');
        expect(storageInfo).toEqual(null);
        expect(ajaxCalls.length).toEqual(1);
        expect(ajaxCalls[0].url).toEqual('https://b.c/.well-known/host-meta');
        expect(ajaxCalls[0].timeout).toEqual(3000);
      });
    });
  });
  describe("OAuth helpers", function() {
    it("should create an OAuth address", function() {//test 4
      var redirectUri = 'http://unhosted.org/asdf/qwer.html';
      var oauthAddress = remoteStorage.createOAuthAddress(
        {auth:'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org'},
        ['asdf'],
        redirectUri
        );
      expect(oauthAddress).toEqual(
        'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org?redirect_uri='+encodeURIComponent(redirectUri)+'&scope=asdf&response_type=token&client_id='+encodeURIComponent(redirectUri)
        );
    });
    it("should receive a token from the fragment, first position", function() {//test 9
      location.hash='#access_token=asdf&bla';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
    it("should receive a token from the fragment, middle position", function() {//test 10
      location.hash='#a=b&access_token=asdf&bla=wa';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
    it("should receive a token from the fragment, middle position", function() {//test 11
      location.hash='#foo=bar&access_token=asdf';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
  });

});
