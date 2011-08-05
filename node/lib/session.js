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

  function init(req, res) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var postData = querystring.parse(content)
      browserIdVerify(postData.browserIdAssertion, function(verifiedUserAddress) {
        if(verifiedUserAddress) {
          //generate a crypto password:
          var session = {cryptoPwdForRead: {}
            , cryptoPwdForWrite: genCryptoPwd()
            , userAddress: verifiedUserAddress
            , sessionKey: Math.random()//will be used when adding storage
            }
          //see if this user has been here before:
          var redisClient = redis.createClient()
          redisClient.get('_session_'+verifiedUserAddress+'_'+postData.dataScope, function(err, data) {
            console.log('redis err:'+JSON.stringify(err))
            console.log('redis data:'+JSON.stringify(data))
            if(data) {
              try {
               var existingSession = JSON.parse(data)
                console.log('Found session for '+verifiedUserAddress+', scope '+postData.dataScope+'.')
                session.storage = existingSession.storage
                session.cryptoPwdForRead = existingSession.cryptoPwdForRead
              } catch(e) {
                console.log(JSON.stringify(e))
              }
            }
            setSession(session, res)
          })
        } else {
          res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
          res.end(JSON.stringify({}))
        }
      })
    })
  }

  function requestHosting(res, req) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var postData = querystring.parse(content)
      //see if this user has been here before:
      var redisClient = redis.createClient()
      redisClient.get('_session_'+postData.userAddress+'_'+postData.dataScope, function(err, data) {
        console.log('redis err:'+JSON.stringify(err))
        console.log('redis data:'+JSON.stringify(data))
        if(data) {
          try {
            var existingSession = JSON.parse(data)
            if(postData.sessionKey == existingSession.sessionKey) {
              console.log('Found session for '+verifiedUserAddress+', scope '+postData.dataScope+'.')
              console.log(JSON.stringify(postData))
              https.request({host: config.ownCloudLink.host
                           , port: config.ownCloudLink.port
                           , path: config.ownCloudLink.path
                           , method: config.ownCloudLink.method
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
                  session.storage=JSON.parse(resultStr)
                  setSession(session, res)
                })
              }).on('error', function(e) {
                console.log('problem with request: '+e.message)
              }).write(postData)
            }
          } catch(e) {
            res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
            res.end(JSON.stringify({}))
          }
        }
      })
    })
  }

  function update(res, req) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var postData = querystring.parse(content)
      //see if this user has been here before:
      var redisClient = redis.createClient()
      redisClient.get('_session_'+postData.userAddress+'_'+postData.dataScope, function(err, data) {
        console.log('redis err:'+JSON.stringify(err))
        console.log('redis data:'+JSON.stringify(data))
        if(data) {
          try {
            var existingSession = JSON.parse(data)
            if(postData.sessionKey == existingSession.sessionKey) {
              console.log('Found session for '+verifiedUserAddress+', scope '+postData.dataScope+'.')
              console.log(JSON.stringify(postData))
              existingSession.storage=postData.storage
              setSession(existingSession, res)
            }
          } catch(e) {
            res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
            res.end(JSON.stringify({}))
          }
        }
      })
    })
  }

  function setSession(session, res) {
    var redisClient = redis.createClient()
    redisClient.set('_session_'+session.userAddress+'_'+postData.dataScope, JSON.stringify(session), function(err, data) {
      console.log('redis err:'+JSON.stringify(err))
      console.log('redis data:'+JSON.stringify(data))
      res.writeHead(200, {'Access-Control-Origin-Allow': '*'})
      res.end(JSON.stringify(session))
    })
  }
  module.exports.init = init
  module.exports.requestHosting = requestHosting
  module.exports.update = update
})()
