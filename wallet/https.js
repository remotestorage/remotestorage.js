var fs = require('fs')
var https = require('https')

https.createServer({
  key:fs.readFileSync('/root/ssl.key'),
  cert:fs.readFileSync('/root/ssl.crt')
}, function(req	, res) {
  res.writeHead(200)
  res.end(fs.readFileSync('/root/browsermail.html'))
}).listen(443)
