require(['./remoteStorage'], function(remoteStorage){
  describe("webfinger functions", function() {
    it("should fail to parse a bogus host-meta", function() {
      runs(function() {
        remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
          expect(err).toEqual('JSON parsing failed - asdf');
          expect(storageInfo).toEqual(null);
          expect(sinonRequests.length).toEqual(1);
          expect(sinonRequests[0].url).toEqual('https://b.c/.well-known/host-meta');
          expect(sinonRequests[0].timeout).toEqual(3000);
        });
        sinonRequests[0].respond(404, {}, 'asdf');
      });
      waits(100);
    });
    it("should fail on lrdd 403", function() {
      runs(function() {
        remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
          expect(err).toEqual('the template doesn\'t contain "{uri}"');
          expect(storageInfo).toEqual(null);
          expect(sinonRequests.length).toEqual(2); 
          expect(sinonRequests[0].url).toEqual('https://b.c/.well-known/host-meta');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[1].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
          expect(sinonRequests[1].timeout).toEqual(3000);
        });
        sinonRequests[0].respond(200, {}, '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
            +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
            +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'          <Link rel=\'lrdd\''
            +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>');
        sinonRequests[1].respond(403, {}, '');
      });
      waits(100);
    });
    it("should succeed in getting a valid xml-based webfinger record", function() {
      runs(function() {
        remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
          expect(err).toEqual(0);
          expect(storageInfo.api).toEqual('simple');
          expect(storageInfo.template).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/');
          expect(storageInfo.auth).toEqual('http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org');
          expect(sinonRequests.length).toEqual(2);
          expect(sinonRequests[0].url).toEqual('https://b.c/.well-known/host-meta');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[1].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
          expect(sinonRequests[1].timeout).toEqual(3000);
        });
        sinonRequests[0].respond(200, {}, '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
            +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
            +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'          <Link rel=\'lrdd\''
            +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>');
        sinonRequests[1].respond(200, {}, ''<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
            +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\' xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'<Link rel=\'remoteStorage\' api=\'simple\' auth=\'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org\''
            +' template=\'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/\'></Link></XRD>');
      });
      waits(100);
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
  describe("REST client", function() {
    it("should report 404s as undefined", function() {
      runs(function() {
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.get('foo', function(err,  data) {
          expect(err).toEqual(null);
          expect(data).toEqual(undefined);
          expect(sinonRequests[0].fields.withCredentials).toEqual('true');
          expect(sinonRequests[0].headers.Authorization).toEqual('Bearer qwer');
          expect(sinonRequests[0].method).toEqual('GET');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
        sinonRequests[0].respond(404, {}, '');
      });
      waits(100);
    });
    it("should GET foo", function() {
      runs(function() {
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.get('foo', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(sinonRequests[0].fields.withCredentials).toEqual('true');
          expect(sinonRequests[0].headers.Authorization).toEqual('Bearer qwer');
          expect(sinonRequests[0].method).toEqual('GET');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
        sinonRequests[0].respond(200, {}, 'bar');
      });
      waits(100);
    });
    it("should PUT foo bar", function() {
      runs(function() {
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.put('foo', 'bar', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(sinonRequests[0].fields.withCredentials).toEqual('true');
          expect(sinonRequests[0].headers.Authorization).toEqual('Bearer qwer');
          expect(sinonRequests[0].method).toEqual('PUT');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
          expect(sinonRequests[0].data).toEqual('bar');
        });
        sinonRequests[0].respond(200, {}, 'bar');
      });
      waits(100);
    });
    it("should DELETE foo", function() {
      runs(function() {
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.delete('foo', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(sinonRequests[0].fields.withCredentials).toEqual('true');
          expect(sinonRequests[0].headers.Authorization).toEqual('Bearer qwer');
          expect(sinonRequests[0].method).toEqual('DELETE');
          expect(sinonRequests[0].timeout).toEqual(3000);
          expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
        sinonRequests[0].respond(200, {}, 'bar');
      });
      waits(100);
    });
  });
});
