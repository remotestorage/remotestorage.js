
describe('platform', function() {

  var XRD = '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n'
    +'<XRD xmlns=\'http://docs.oasis-open.org/ns/xri/xrd-1.0\' xmlns:hm=\'http://host-meta.net/xrd/1.0\'>\n'
    +'  <Link rel="remoteStorage" href="http://a.b/c/d">\n'
    +'    <Property type="auth-method">https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2</Property>\n'
    +'    <Property type="auth-endpoint">http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org</Property>\n'
    +'  </Link>\n</XRD>';
  
  var platform;

  beforeEach(function() {
    platform = specHelper.getFile('platform');
  });

  describe('parseXml', function() {
    var error, result;

    beforeEach(function() {
      platform.parseXml(XRD, function(err, res) {
        error = err;
        result = res;
      });
    });

    it("yields a single link", function() {
      expect(result.Link.length).toBe(1)
      var link = result.Link[0]['@'];
      expect(link).toNotBe(undefined);
    });

    it("sets the properties correctly", function() {
      var link = result.Link[0]['@'];
      expect(link.properties['auth-method']).toEqual('https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2');
      expect(link.properties['auth-endpoint']).toEqual('http://surf.unhosted.org:4000/_oauth/michiel@unhosted.org');
    });

    it("sets href and rel correctly", function() {
      var link = result.Link[0]['@'];
      expect(link.rel).toEqual('remoteStorage');
      expect(link.href).toEqual('http://a.b/c/d');
    });

  });

});