(function() {
  var fs = require('fs')
    , redis = require('redis').createClient()
    , url = require('url')
    , querystring = require('querystring')

  function browserIdVerify(assertion, cb) {
    if(data.authType=='BrowserId') {
      postData = querystring.stringify({
        'assertion': data.assertion,
        'audience': 'mail.myfavouritesandwich.org'
      })
      https.request( { host: 'browserid.org'
                     , port: 443
                     , path: '/verify'
                     , method: 'POST'
                     , headers: { 'Content-Length': postData.length
                                , 'Content-Type': 'application/x-www-form-urlencoded'
                                }
                     }
                   , function( res ){
        console.log('STATUS: '+ res.statusCode )
        console.log('HEADERS: '+ JSON.stringify( res.headers ))
        res.setEncoding( 'utf8' )
        var resultStr = '';
        res.on('data', function( chunk ){
          console.log('BODY: '+ chunk )
          resultStr += chunk
        })
        res.on('end', function() {
          var result = JSON.parse(resultStr)
          if( result.status == 'okay' ){
            cb( true )
          } else {
            cb( false )
          }
        })
      }).on('error', function(e) {
        console.log('problem with request: '+e.message)
      }).write(postData)
    }
  }
  function isHosted(userAddress) {
    return true
  }

  function handle(req, res) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var postData = querystring.parse(content)
      browserIdVerify(postData.assertion, function(result) {
        if(result.status == 'okay') {
          if(isHosted(result.email)) {
            var wallet =
              { userAddress: result.email
              , storageType: 'http://unhosted.org/spec/dav/0.1'
              , dataScope: 'sandwiches'
              , hostedDavUrl: 'https://myfavouritesandwich.org/'
              , hostedDavToken: 'abcd'
              , cryptoPwdForRead: {favSandwich: '1234'}
              , cryptoPwdForWrite: '1234'
              }
          } else {
            var wallet = {userAddress: result.email}
          }
          res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
          res.end(JSON.stringify(wallet))
        }
      })
    })
  }

  module.exports.handle = handle
})()
