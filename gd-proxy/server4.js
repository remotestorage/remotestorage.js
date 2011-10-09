var http = require('http')
var google = http.createClient(80, 'docs.google.com')
var request = google.request
  ( 'PUT'
  , '/feeds/default/private/full/document%DOCNAME'
  , { 'host': 'docs.google.com'
    , 'GData-Version': '3.0'
    , 'Authorization': 'Bearer TOKEN'
    , 'Content-Length': '10'
    , 'Content-Type': 'text/plain'
    , 'Slug': 'LetsRide'
    , 'Content-Range': '0 - 9/30'
    }
  )
request.end('one, two, ')
request.on('response', function (response) {
  console.log('STATUS: ' + response.statusCode)
  console.log('HEADERS: ' + JSON.stringify(response.headers))
  response.setEncoding('utf8')
  response.on('data', function (chunk) {
    console.log('BODY: ' + chunk)
  })
})
