var http = require("http")
var request = require("request")
var port = process.env.PORT || 8080

http.createServer(function(req, res) {
  req.headers.host='docs.google.com'
  var options =
    { uri: 'http://docs.google.com/feeds/default/private/full/'
    , headers: req.headers
    }

  request(options, function(err, remoteRes, remoteBody){
    console.log(JSON.stringify(options))
    console.log(JSON.stringify(err))
    console.log(JSON.stringify(remoteRes.headers))
    console.log(JSON.stringify(remoteBody))

    res.writeHead(200/*remoteRes.status*/, remoteRes.headers)
    res.end(remoteBody)
  })

}).listen(port)

console.log("listening on port " + port)

