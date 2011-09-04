(function() {
  var url = require('url')

  function handle(req, res) {
    var path = url.parse(req.url).pathname
    console.log('200: '+path)
    res.writeHead( 200
                 , { 'Access-Control-Origin-Allow': '*'
                 , 'Content-Type': 'application/xml+xrd'
                 }
    )
    if(path == '/.well-known/host-meta') {
      res.write('<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0" xmlns:hm="http://host-meta.net/xrd/1.0">\n'
        + '\t<hm:Host xmlns="http://host-meta.net/xrd/1.0">myfavouritesandwich.org</hm:Host>\n'
        + '\t<Link rel="lrdd" template="https://myfavouritesandwich.org/webfinger?q={uri}">\n'
        + '\t\t<Title>Resource Descriptor</Title>\n'
        + '\t</Link>\n'
        + '</XRD>\n'
        )
    } else if(path == '/webfinger') {
      user = url.parse(req.url).search.substring(3) //TODO: parse this a bit more nicely
      res.write('<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0" xmlns:hm="http://host-meta.net/xrd/1.0">\n'
        + '\t<hm:Host xmlns="http://host-meta.net/xrd/1.0">myfavouritesandwich.org</hm:Host>\n'
        + '\t<Link rel="http://unhosted.org/spec/dav/0.1" href="https://myfavouritesandwich.org:444/apps/unhosted/compat.php/'+user+'/unhosted/"></Link>\n'
        + '</XRD>\n'
        )
    }
    res.end()
  }

  module.exports.handle = handle
})()
