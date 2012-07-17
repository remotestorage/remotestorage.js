(function() {
  describe("webfinger", function() {
    it("should fail to parse a bogus host-meta", function() {
      var webfinger = specHelper.getFile('webfinger');
      var platformStub = specHelper.getStub('webfinger', 'platform');
      platformStub.addFunc('getStorageInfo', 3);
      platformStub.setResponses([undefined]);
      var ret = webfinger.getStorageInfo('a@b.c', {}, function(err, storageInfo) {
        expect(err).toEqual('could not fetch host-meta for a@b.c');
        expect(storageInfo).toEqual(null);
      });
      expect(typeof(ret)).toEqual('undefined');
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(1);
      expect(calls[0].name).toEqual('ajax');
      expect(calls[0].params[0].url).toEqual('https://b.c/.well-known/host-meta.json?resource=acct:a%40b.c');
      expect(typeof(calls[0].params[0].success)).toEqual('function');
      expect(typeof(calls[0].params[0].error)).toEqual('function');
      expect(typeof(calls[0].params[0].timeout)).toEqual('undefined');
      //calls[0].params[0].error(404);
      calls[0].params[0].success('asdf');
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(2);
      expect(calls[1].name).toEqual('parseXml');
      expect(calls[1].params[0]).toEqual('asdf');
      calls[1].params[1]('unparsable', undefined);
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(3);
      calls[2].params[0].success('asdf');
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(4);
      expect(calls[3].name).toEqual('parseXml');
      expect(calls[3].params[0]).toEqual('asdf');
      calls[3].params[1]('unparsable', undefined);
    });
    it("should fail on host-meta 403", function() {
      var webfinger = specHelper.getFile('webfinger');
      var platformStub = specHelper.getStub('webfinger', 'platform');
      platformStub.setResponses([undefined]);
      var ret = webfinger.getStorageInfo('a@b.c', {}, function(err, storageInfo) {
        expect(err).toEqual('could not fetch host-meta for a@b.c');
        expect(storageInfo).toEqual(null);
      });
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(1);
      calls[0].params[0].error(403);
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(2);
      calls[1].params[0].error(403);
    });
    it("should succeed in getting a valid xml-based webfinger record", function() {
      var webfinger = specHelper.getFile('webfinger');
      var platformStub = specHelper.getStub('webfinger', 'platform');
      platformStub.setResponses([undefined]);
      var ret = webfinger.getStorageInfo('a@b.c', {}, function(err, storageInfo) {
        expect(err).toEqual(null);
        expect(storageInfo.type).toEqual('https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#simple');
        expect(storageInfo.href).toEqual('http://surf.unhosted.org:4000/michiel@unhosted.org');
        expect(storageInfo.properties.legacySuffix).toEqual('/hegga');
        expect(storageInfo.properties['auth-endpoint']).toEqual('http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org');
      });
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(1);
      var hostMetaStr = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
        +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\'\n'
        +'     xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
        +'          <Link rel=\'lrdd\''
        +' template=\'http://unhosted.org/.well-known/{uri}.webfinger\'></Link></XRD>';
      calls[0].params[0].success(hostMetaStr);
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(2);
      expect(calls[1].name).toEqual('parseXml');
      expect(calls[1].params[0]).toEqual(hostMetaStr);
      calls[1].params[1](null, {
        Link: [ 
          {
            '@': {
              rel: 'lrdd',
              template: 'http://unhosted.org/.well-known/{uri}.webfinger'
            }
          }
        ]
      });
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(3);
      expect(calls[2].params[0].url).toEqual('http://unhosted.org/.well-known/acct:a@b.c.webfinger');
      var webfingerStr = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
        +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\' xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
        +'<Link rel=\'remoteStorage\' api=\'simple\' auth=\'http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org\'';
      calls[2].params[0].success(webfingerStr);
      var calls = platformStub.getCalled();
      expect(calls.length).toEqual(4);
      expect(calls[3].name).toEqual('parseXml');
      expect(calls[3].params[0]).toEqual(webfingerStr);
      calls[3].params[1](null, {
        remoteStorage: {
          api: 'WebDAV',
          template: 'http://host/foo/{category}/bar',
          auth: 'http://host/auth'
        }
      });
    });
  });
})();
