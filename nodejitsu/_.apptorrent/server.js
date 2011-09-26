require('http').createServer(function(req, res) {
  res.writeHead(200)
  res.end('<html><head><script type="text/javascript" src="http://apptorrent.org/player.js"></script></head></html>')
}).listen(80)
