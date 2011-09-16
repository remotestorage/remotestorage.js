(function() {
  var https = require('https')
    , querystring = require('querystring')
    , redis = require('redis')
    , config = require('../config.js')

  var redisClient = redis.createClient()
 
  function storeSession(session, cb) {
    console.log('store session IN: '+JSON.stringify(session))
    redisClient.set('_session_'+session.userAddress+'_'+session.dataScope, JSON.stringify(session), function(err, data) {
      console.log('store session OUT: '+JSON.stringify(data)+', redis err:'+JSON.stringify(err))
      cb(err, data)
    })
  }
  function retrieveSession(session, cb) {
    console.log('retrieve session IN: '+JSON.stringify(session))
    redisClient.get('_session_'+session.userAddress+'_'+session.dataScope, function(err, data) {
      console.log('retrieve session OUT: '+JSON.stringify(data)+', redis err:'+JSON.stringify(err))
      cb(err, data)
    })
  }
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
            , dataScope: postData.dataScope
            }
          retrieveSession(session, function(err, data) {
            if(data) {
              try {
               var existingSession = JSON.parse(data)
                console.log('Found session for '+verifiedUserAddress+', scope '+postData.dataScope+'.')
      //          session.storage = existingSession.storage
                session.cryptoPwdForRead = existingSession.cryptoPwdForRead
              } catch(e) {
                console.log(JSON.stringify(e))
              }
            }
            setSession(session, res)
          })
        } else {
          res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
          res.end(JSON.stringify({}))
        }
      })
    })
  }

  function requestHosting(req, res) {
    console.log('requestHosting.main')
    var content = ''
    req.on('data', function(chunk) {
      console.log('requestHosting.data')
      content += chunk
    })
    req.on('end', function() {
      console.log('requestHosting.end')
      var session = querystring.parse(content)
      console.log(JSON.stringify(session))
      //see if this user has been here before:
      retrieveSession(session, function(err, data) {
        if(data) {
          try {
            var existingSession = JSON.parse(data)
            if(session.sessionKey == existingSession.sessionKey) {
              console.log('Found session for '+session.userAddress+', scope '+session.dataScope+'. will now call ownCloudLink:')
              var postData = querystring.stringify({userAddress: session.userAddress
                , dataScope: session.dataScope
                , secret: config.ownCloudLink.secret
                })
              https.request({host: config.ownCloudLink.host
                           , port: config.ownCloudLink.port
                           , path: config.ownCloudLink.path
                           , method: config.ownCloudLink.method
                           , headers: { 'Content-Length': postData.length
                                      , 'Content-Type': 'application/x-www-form-urlencoded'
                                      }
                           }, function( postRes ){
                console.log('STATUS: '+ res.statusCode )
                console.log('HEADERS: '+ JSON.stringify( res.headers ))
                postRes.setEncoding( 'utf8' )
                var resultStr = ''
                postRes.on('data', function( chunk ){
                  console.log('BODY: '+ chunk )
                  resultStr += chunk
                })
                postRes.on('end', function() {
                  result=JSON.parse(resultStr)
                  console.log(resultStr)
                  session.storage=result.storage
                  session.ownCloudDetails=result.ownCloudDetails
                  setSession(session, res)
                })
              }).on('error', function(e) {
                console.log('problem with request: '+e.message)
              }).write(postData)
            }
          } catch(e) {
            console.log('ERROR:'+JSON.stringify(e))
            res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
            res.end(JSON.stringify({}))
          }
        } else {
          res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
          res.end(JSON.stringify({}))
        }
      })
    })
  }

  function update(req, res) {
    var content = ''
    req.on('data', function(chunk) {
      content += chunk
    })
    req.on('end', function() {
      var session = querystring.parse(content)
      //see if this user has been here before:
      console.log('redisClient.get(_session_'+session.userAddress+'_'+session.dataScope+')')
      redisClient.get('_session_'+session.userAddress+'_'+session.dataScope, function(err, data) {
        console.log('redis err:'+JSON.stringify(err))
        console.log('redis data:'+JSON.stringify(data))
        if(data) {
          try {
            var existingSession = JSON.parse(data)
            if(session.sessionKey == existingSession.sessionKey) {
              console.log('Found session for '+session.userAddress+', scope '+session.dataScope+'.')
              console.log(JSON.stringify(session))
              setSession(session, res)
            }
          } catch(e) {
            res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
            res.end(JSON.stringify({}))
          }
        }
      })
    })
  }

  function setSession(session, res) {
    storeSession(session, function(err, data) {
      console.log('redis err:'+JSON.stringify(err))
      console.log('redis data:'+JSON.stringify(data))
      res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
      res.end(JSON.stringify(session))
    })
  }
  module.exports.init = init
  module.exports.requestHosting = requestHosting
  module.exports.update = update
})()
