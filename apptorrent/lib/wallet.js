(function() {
  var https = require('https')
    , querystring = require('querystring')
    , redis = require('redis')
    , config = require('../config.js')

  function browserIdVerify(assertion, cb) {
    postData = querystring.stringify({
      'assertion': assertion,
      'audience': config.browserIdAudience
    })
    console.log(JSON.stringify(postData))
    https.request({host: config.browserIdVerifier.host
                 , port: config.browserIdVerifier.port
                 , path: config.browserIdVerifier.path
                 , method: config.browserIdVerifier.method
                 , headers: { 'Content-Length': postData.length
                            , 'Content-Type': 'application/x-www-form-urlencoded'
                            }
                 }, function( res ){
      console.log('STATUS: '+ res.statusCode )
      console.log('HEADERS: '+ JSON.stringify( res.headers ))
      res.setEncoding( 'utf8' )
      var resultStr = ''
      res.on('data', function( chunk ){
        console.log('BODY: '+ chunk )
        resultStr += chunk
      })
      res.on('end', function() {
        var result = JSON.parse(resultStr)
        if( result.status == 'okay' ){
          cb( result.email )
        } else {
          cb( false )
        }
      })
    }).on('error', function(e) {
      console.log('problem with request: '+e.message)
    }).write(postData)
  }

  function genCryptoPwd() {
     return 'asdf'
  }

  function handle(req, res) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var postData = querystring.parse(content)
      browserIdVerify(postData.browserIdAssertion, function(verifiedUserAddress) {
        if(verifiedUserAddress) {
          //generate a crypto password:
          var wallet = {cryptoPwdForRead: {}
                , cryptoPwdForWrite: genCryptoPwd()
                }
          //see if this user has been here before:
          var redisClient = redis.createClient()
          redisClient.get('_wallet_'+verifiedUserAddress+'_'+postData.dataScope, function(err, data) {
            console.log('redis err:'+JSON.stringify(err))
            console.log('redis data:'+JSON.stringify(data))
            if(data) {
              try {
                var existingWallet = JSON.parse(data)
                console.log('Found wallet for '+verifiedUserAddress+', scope '+postData.dataScope+'.')
                //since you are authenticating newly, we presume you don't want old/existing sessions
                //to access the new data you write. 
                //We want to copy existing storage tokens and cryptoPwdForRead, but we the cryptoPwdForWrite is always generated newly
                wallet.storage = existingWallet.storage
                wallet.cryptoPwdForRead = existingWallet.cryptoPwdForRead
              } catch(e) {
                console.log(JSON.stringify(e))
              }
            }
            redisClient.set('_wallet_'+verifiedUserAddress+'_'+postData.dataScope, JSON.stringify(wallet), function(err, data) {
              console.log('redis err:'+JSON.stringify(err))
              console.log('redis data:'+JSON.stringify(data))
              wallet.userAddress = verifiedUserAddress
              res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
              res.end(JSON.stringify(wallet))
            })
          })
        } else {
          res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
          res.end(JSON.stringify({}))
        }
      })
    })
  }

  module.exports.handle = handle
})()
