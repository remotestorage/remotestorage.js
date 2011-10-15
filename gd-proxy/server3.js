var http = require('http')
var google = http.createClient(80, 'docs.google.com')
var request = google.request('POST', '/feeds/default/private/full',
  { 'host': 'docs.google.com'
  , 'GData-Version': '3.0'
  , 'Authorization': 'Bearer ya29.AHES6ZQIUliUulhSSuDLMv9XcHw6U1PHMoAYCfMFI2dU7kVXGxjt19A'
  , 'Content-Length': '0'
  , 'Content-Type': 'text/plain'
  , 'Slug': 'LetsRide'
  , 'X-Upload-Content-Length': '30'
  , 'X-Upload-Content-Type': 'text/plain'
  })
request.end();
request.on('response', function (response) {
  console.log('STATUS: ' + response.statusCode)
  console.log('HEADERS: ' + JSON.stringify(response.headers))
  response.setEncoding('utf8')
  response.on('data', function (chunk) {
    console.log('BODY: ' + chunk)
  })
})
