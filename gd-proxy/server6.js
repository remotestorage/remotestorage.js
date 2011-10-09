var http = require('http')

http.createServer(function (req, res) {
  console.log(req.url)
  if(req.url.length < 2) {
    res.writeHead(200)
    res.end('<a href="'
      + 'https://accounts.google.com/o/oauth2/auth?'
      + 'client_id=709507725318-4h19nag3k4hv5osj1jvao0j3an3bu43t@developer.gserviceaccount.com&'
      + 'redirect_uri=http://apptorrent.org:9000/&'
      + 'scope=http://docs.google.com/feeds/&'
      + 'response_type=token'
      + '">click</a>')
  } else {
    var token = req.url.substring(2)
    console.log(token)
    var google = http.createClient(80, 'docs.google.com')
    var request = google.request('POST', '/feeds/default/private/full',
      { 'host': 'docs.google.com'
      , 'GData-Version': '3.0'
      , 'Authorization': 'Bearer '+token
      , 'Content-Length': '0'
      , 'Content-Type': 'text/plain'
      , 'Slug': 'LetsRide'
      , 'X-Upload-Content-Length': '30'
      , 'X-Upload-Content-Type': 'text/plain'
      }
    )
    request.end()
    request.on('response', function (response) {
      console.log('STATUS: ' + response.statusCode)
      console.log('HEADERS: ' + JSON.stringify(response.headers))
      response.setEncoding('utf8')
      response.on('data', function (chunk) {
        console.log('BODY: ' + chunk)
      })
    })
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*'})
    res.write('request successfully proxied: ' + req.url +'\n' + JSON.stringify(req.headers, true, 2))
    res.end()
  }
}).listen(9000)
