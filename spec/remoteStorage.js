require(['./test/remoteStorage'], function(remoteStorage){
  describe("webfinger functions", function() {
    it("should fail to parse a bogus host-meta", function() {
      runs(function() {
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
      waits(100);
    });
    it("should fail on lrdd 403", function() {
      runs(function() {
        ajaxResponses = [{
          success: false,
          err: 403
        }, {
          success: true,
          data: '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
            +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
            +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'          <Link rel=\'lrdd\''
            +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>'
        }];
        ajaxCalls = [];
        remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
          expect(err).toEqual('the template doesn\'t contain "{uri}"');
          expect(storageInfo).toEqual(null);
          expect(ajaxCalls.length).toEqual(2); 
          expect(ajaxCalls[0].url).toEqual('https://b.c/.well-known/host-meta');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[1].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
          expect(ajaxCalls[1].timeout).toEqual(3000);
        });
      });
      waits(100);
    });
    it("should succeed in getting a valid xml-based webfinger record", function() {
      runs(function() {
        ajaxResponses = [{
          success: true,
          data: '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\' xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'<Link rel=\'remoteStorage\' api=\'simple\' auth=\'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org\''
            +' template=\'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/\'></Link></XRD>'
        }, {
          success: true,
          data: '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
            +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
            +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
            +'          <Link rel=\'lrdd\''
            +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>'
        }];
        ajaxCalls = [];
        remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
          expect(err).toEqual(0);
          expect(storageInfo.api).toEqual('simple');
          expect(storageInfo.template).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/');
          expect(storageInfo.auth).toEqual('http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org');
          expect(ajaxCalls.length).toEqual(2);
          expect(ajaxCalls[0].url).toEqual('https://b.c/.well-known/host-meta');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[1].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
          expect(ajaxCalls[1].timeout).toEqual(3000);
        });
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
    it("should report 404s as 404s", function() {
      runs(function() {
        ajaxResponses=[{
          success:false,
          err:404
        }];
        ajaxCalls=[];
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.get('foo', function(err, data) {
          expect(err).toEqual(404);
          expect(data).toEqual(null);
          expect(ajaxCalls[0].fields.withCredentials).toEqual('true');
          expect(ajaxCalls[0].headers.Authorization).toEqual('Bearer qwer');
          expect(ajaxCalls[0].method).toEqual('GET');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
      });
      waits(100);
    });
    it("should GET foo", function() {
      runs(function() {
        ajaxResponses=[{
          success:true,
          data:'bar'
        }];
        ajaxCalls=[];
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.get('foo', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(ajaxCalls[0].fields.withCredentials).toEqual('true');
          expect(ajaxCalls[0].headers.Authorization).toEqual('Bearer qwer');
          expect(ajaxCalls[0].method).toEqual('GET');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
      });
      waits(100);
    });
    it("should PUT foo bar", function() {
      runs(function() {
        ajaxResponses=[{
          success:true,
          data:'bar'
        }];
        ajaxCalls=[];
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.put('foo', 'bar', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(ajaxCalls[0].fields.withCredentials).toEqual('true');
          expect(ajaxCalls[0].headers.Authorization).toEqual('Bearer qwer');
          expect(ajaxCalls[0].method).toEqual('PUT');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
          expect(ajaxCalls[0].data).toEqual('bar');
        });
      });
      waits(100);
    });
    it("should DELETE foo", function() {
      runs(function() {
        ajaxResponses=[{
          success:true,
          data:'bar'
        }];
        ajaxCalls=[];
        var client = remoteStorage.createClient({api:'simple', template:'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/'}, 'asdf', 'qwer');
        client.delete('foo', function(err, data) {
          expect(err).toEqual(null);
          expect(data).toEqual('bar');
          expect(ajaxCalls[0].fields.withCredentials).toEqual('true');
          expect(ajaxCalls[0].headers.Authorization).toEqual('Bearer qwer');
          expect(ajaxCalls[0].method).toEqual('DELETE');
          expect(ajaxCalls[0].timeout).toEqual(3000);
          expect(ajaxCalls[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        });
      });
      waits(100);
    });
  });
});
