(function() {
  describe("webfinger functions", function() {
    it("should fail to parse a bogus host-meta", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
        expect(err).toEqual('JSON parsing failed - asdf');
        expect(storageInfo).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].url).toEqual('https://b.c/.well-known/host-meta');
      });
      sinonRequests[0].respond(404, {}, 'asdf');
      sinonRequests[1].respond(404, {}, 'asdf');
      specHelper.tearDownXhr();
    });
    it("should fail on host-meta 403", function() {
      specHelper.setUpServer();
      var remoteStorage = specHelper.getRemoteStorage();
      sinonServer.respondWith('GET', 'https://b.c/.well-known/host-meta', [403, {}, '']);
      sinonServer.respondWith('GET', 'http://unhosted.org/.well-known/acct:a@b.c.webfinger', [403, {}, '']);
      sinonServer.respondWith('GET', 'http://proxy.unhosted.org/testIrisCouch?q=acct:a@b.c.webfinger', [404, {}, '']);
        
      var callback=sinon.spy();
      remoteStorage.getStorageInfo('a@b.c', callback);
      
      sinonServer.respond();
      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, 'err: during IrisCouch test:404', undefined);
      specHelper.tearDownServer();
    });
    it("should succeed in getting a valid xml-based webfinger record", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      remoteStorage.getStorageInfo('a@b.c', function(err, storageInfo) {
        expect(err).toEqual(null);
        expect(storageInfo.type).toEqual('https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple');
        expect(storageInfo.href).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org');
        expect(storageInfo.properties.legacySuffix).toEqual('/hegga');
        expect(storageInfo.properties['http://oauth.net/core/1.0/endpoint/request']).toEqual('http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org');
        expect(sinonRequests.length).toEqual(2);
        expect(sinonRequests[0].url).toEqual('https://b.c/.well-known/host-meta');
        expect(sinonRequests[1].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
      });
      sinonRequests[0].respond(200, {}, '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
          +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
          +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
          +'          <Link rel=\'lrdd\''
          +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>');
      sinonRequests[1].respond(200, {}, '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
          +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\' xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
          +'<Link rel=\'remoteStorage\' api=\'simple\' auth=\'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org\''
          +' template=\'http://surf.unhosted.org:4000/michiel@unhosted.org/{category}/hegga\'></Link></XRD>');
      specHelper.tearDownXhr();
    });
  });
  describe("OAuth helpers", function() {
    it("should create an OAuth address", function() {//test 4
      var remoteStorage = specHelper.getRemoteStorage();
      var redirectUri = 'http://unhosted.org/asdf/qwer.html';
      var oauthAddress = remoteStorage.createOAuthAddress(
        {
          type: 'https://www.w3.org/community/rww/wiki/read-write-web-00#simple',
          properties: {
            'http://oauth.net/core/1.0/endpoint/request': 'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org'
          }
        },
        ['asdf:rw', 'qw/er:r', 'public/asdf:r'],
        redirectUri
        );
      expect(oauthAddress).toEqual(
        'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org?redirect_uri='+encodeURIComponent(redirectUri)
          +'&scope='+encodeURIComponent('asdf:rw qw/er:r public/asdf:r')+'&response_type=token&client_id='+encodeURIComponent(redirectUri)
      );
    });
    it("should create a legacy OAuth address", function() {//test 4
      var remoteStorage = specHelper.getRemoteStorage();
      var redirectUri = 'http://unhosted.org/asdf/qwer.html';
      var oauthAddress = remoteStorage.createOAuthAddress(
        {
          type: 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav',
          properties: {
            'http://oauth.net/core/1.0/endpoint/request': 'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org'
          }
        },
        ['asdf:rw', 'qw/er:r', 'public/asdf:r'],
        redirectUri
        );
      expect(oauthAddress).toEqual(
        'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org?redirect_uri='+encodeURIComponent(redirectUri)
          +'&scope='+encodeURIComponent('asdf,qw,public')+'&response_type=token&client_id='+encodeURIComponent(redirectUri)
      );
    });
    it("should receive a token from the fragment, first position", function() {//test 9
      var remoteStorage = specHelper.getRemoteStorage();
      location.hash='#access_token=asdf&bla';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
    it("should receive a token from the fragment, middle position", function() {//test 10
      var remoteStorage = specHelper.getRemoteStorage();
      location.hash='#a=b&access_token=asdf&bla=wa';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
    it("should receive a token from the fragment, middle position", function() {//test 11
      var remoteStorage = specHelper.getRemoteStorage();
      location.hash='#foo=bar&access_token=asdf';
      var token = remoteStorage.receiveToken();
      expect(token).toEqual('asdf');
    });
  });
  describe("'simple' client", function() {
    it("should report 404s as undefined", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-simple-2011.10', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err,  data) {
        expect(err).toEqual(null);
        expect(data).toEqual(undefined);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(404, {}, '');
      specHelper.tearDownXhr();
    });
    it("should GET foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#simple', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual('bar');
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(200, {}, 'bar');
      specHelper.tearDownXhr();
    });
    it("should PUT foo bar", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#simple', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.put('foo', 'bar', function(err) {
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('PUT');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        expect(sinonRequests[0].requestBody).toEqual('bar');
      });
      sinonRequests[0].respond(201, {}, '');
      specHelper.tearDownXhr();
    });
    it("should DELETE foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#simple', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.delete('foo', function(err) {
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('DELETE');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(200, {}, '{"ok":"true"}');
      specHelper.tearDownXhr();
    });
  });
  describe("'WebDAV' client", function() {
    it("should report 404s as undefined", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#webdav', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err,  data) {
        expect(err).toEqual(null);
        expect(data).toEqual(undefined);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(404, {}, '');
      specHelper.tearDownXhr();
    });
    it("should GET foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#webdav', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual('bar');
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(200, {}, 'bar');
      specHelper.tearDownXhr();
    });
    it("should PUT foo bar", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#webdav', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.put('foo', 'bar', function(err) {
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('PUT');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        expect(sinonRequests[0].requestBody).toEqual('bar');
      });
      sinonRequests[0].respond(201, {}, '');
      specHelper.tearDownXhr();
    });
    it("should DELETE foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#webdav', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.delete('foo', function(err) {
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('DELETE');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(200, {}, 'bar');
      specHelper.tearDownXhr();
    });
  });
  describe("'CouchDB' client", function() {
    it("should report 404s as undefined", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err,  data) { 
        expect(err).toEqual(null);
        expect(data).toEqual(undefined);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(404, {}, '');
      specHelper.tearDownXhr();
    });
    it("should GET foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.get('foo', function(err, data) {
        expect(err).toEqual(null);
        expect(data).toEqual('bar');
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('GET');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
      });
      sinonRequests[0].respond(200, {}, '{"_rev":"123", "value":"bar"}');
      specHelper.tearDownXhr();
    });
    it("should PUT foo bar", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.put('foo', 'bar', function(err) {
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('PUT');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo');
        expect(sinonRequests[0].requestBody).toEqual('{"value":"bar","_rev":"123"}');
      });
      sinonRequests[0].respond(200, {}, '{"ok":"true","rev":"456"}');
      specHelper.tearDownXhr();
    });
    it("should overcome a 409 on PUT", function() {
      specHelper.setUpServer();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      sinonServer.respondWith('PUT', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo', [409, {}, 'say the magic word!']);
      sinonServer.respondWith('GET', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo',
        [200, {}, '{"_rev":"789", "value":"bla"}']);
        
      var callback=sinon.spy();
      client.put('foo', 'bar', callback);
      sinonServer.respond();
      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, 'after 409, second attempt got 409');
      specHelper.tearDownServer();
    });
    it("should DELETE foo", function() {
      specHelper.setUpXhr();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      client.delete('foo', function(err) { 
        expect(err).toEqual(null);
        expect(sinonRequests.length).toEqual(1);
        expect(sinonRequests[0].requestHeaders.Authorization).toEqual('Bearer qwer');
        expect(sinonRequests[0].method).toEqual('DELETE');
        expect(sinonRequests[0].url).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo?rev=789');
      });
      sinonRequests[0].respond(200, {}, 'bar');
      specHelper.tearDownXhr();
    });
    it("should overcome a 409 on DELETE", function() {
      specHelper.setUpServer();
      var remoteStorage = specHelper.getRemoteStorage();
      var client = remoteStorage.createClient({type:'pds-remotestorage-00#couchdb', href:'http://surf.unhosted.org:4000/michiel@unhosted.org', properties:{}}, 'asdf', 'qwer');
      sinonServer.respondWith('DELETE', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo', [409, {}, 'say the magic word!']);
      sinonServer.respondWith('DELETE', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo?rev=456', [409, {}, 'say the magic word!']);
      sinonServer.respondWith('DELETE', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo?rev=789', [409, {}, 'see how you react to a 2nd one']);
      sinonServer.respondWith('GET', 'http://surf.unhosted.org:4000/michiel@unhosted.org/asdf/foo',
        [200, {}, '{"_rev":"789", "value":"bla"}']);
        
      var callback=sinon.spy();
      client.delete('foo', callback);
      sinonServer.respond();
      sinon.assert.calledOnce(callback);
      sinon.assert.calledWith(callback, 'after 409, second attempt got 409');
      specHelper.tearDownServer();
    });
  });
})();
