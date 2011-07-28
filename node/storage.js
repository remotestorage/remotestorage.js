(function() {
  var fs = require('fs')
    , redis = require('redis').createClient()
    , url = require('url')
    , querystring = require('querystring')

  function getDavToken(userAddress, cb) {
    redis.get('_token_'+ userAddress, function(err, data) {
      cb(data)
    })
  }

  function checkAuthToken(req, userAddress, cb) {
    getDavToken(userAddress, function(davToken) {
      var hash = new Buffer(userAddress +':'+ davToken).toString('base64')
      cb(req.headers.authorization == 'Basic '+ hash) 
    })
  }

  function checkCredentials(req, res, cb) {
    if(checkAuthToken(req, 'mich@myfavouritesandwich.org')) {
      cb(req, res)
    } else {
      res.writeHead(401, {'Access-Control-Allow-Origin': req.headers.Origin})
      res.end()
    }
  }

  function serveGet(req, res) {
    redis.get('storage_'+req.path, function(err, data) {
      if(data) {
        res.writeHead(200, {'Access-Control-Allow-Origin': '*'})
        res.end(data)
      } else {
        res.writeHead(404, {'Access-Control-Allow-Origin': '*'})
        res.end()
      }
    })
  }

  function serveOptions(req, res) {
    res.writeHead(200, { 'Access-Control-Allow-Origin': req.headers.Origin
                       , 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS'
                       , 'Access-Control-Allow-Credentials': true
                       , 'Access-Control-Allow-Headers': 'Authorization'
                       })
    res.end()
  }

  function servePut(req, res) {
    var content = ''
    req.addListener('data', function(chunk) {
      content += chunk
    })
    req.addListener('end', function() {
      redis.set('storage_'+req.path, content, function(err, data) {
      res.writeHead(204, {'Access-Control-Allow-Origin': req.headers.Origin})
        res.end()
      })
    })
  }

  function serveDelete(req, res) {
    redis.delete('storage_'+req.path, function(err, data) {
      res.writeHead(204, {'Access-Control-Allow-Origin': req.headers.Origin})
      res.end()
    })
  }

  function handleWebdav(req, res) {
    if(req.method == 'GET') {
      serveGet(req, res)
    } else if(req.method == 'OPTIONS') {
      serveOptions(req, res)
    } else if(req.method == 'PUT') {
      checkCredentials(req, res, servePut)
    } else if(req.method == 'DELETE') {
      checkCredentials(req, res, serveDelete)
    }
  }

  function handleOauth(req, res) {
    res.writeHead(301, {Location: querystring.parse(req.url).redirect_uri+'#access_token=asdf'})
    res.end()
  }

  module.exports.handleOAuth = handleOauth
  module.exports.handleWebdav = handleWebdav
})()
