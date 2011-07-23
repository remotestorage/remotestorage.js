var io = require('socket.io'),
  redis = require('redis').createClient(),
  smtp = require('smtp'),
  https = require('https'),
  querystring = require('querystring')

var browsermail = (function() {
  var sockets = {}
  require('smtp').createServer(function(connection) {
    connection.on('DATA', function(message) {
      for(var i = 0; i < message.recipients.length; i++) {
        var emailAddress = message.recipients[i].address.match(/([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)/g)[0]
        if(socket = sockets[emailAddress]) {
          message.on('data', function(data) {
            socket.emit('data', data)
          })
          message.on('end', function() {
            socket.emit('end')
            message.accept()
          })
        }
      }
    })
  }).listen(25)

  return {
    addForward: function(emailAddress, socket) {
      sockets[emailAddress] = socket
    }
  }
})()


var users = (function() {
  function checkUser(userName, otherEmailAddress, createIfNotExists, cb) {
    redis.get('user2otherEmail_'+userName, function(err, data) {
      console.log('got '+data+' back for '+userName)
      if(data) {
        if(data == otherEmailAddress) {
          console.log('ok:')
          cb(true)
        } else {
          console.log('taken by someone else:')
          cb(false)
        }
      } else {
        if(createIfNotExists) {
          console.log('create:')
          redis.set('user2otherEmail_'+userName, otherEmailAddress, function(err, data) {
            console.log('created:')
            cb(true)
          })
        } else {
          console.log('not creating:')
          cb(false)
        }
      }
    })
  }
  function checkCredentials(data, cb) {
    if(data.authType=='BrowserId') {
      postData = querystring.stringify({
        'assertion': data.assertion,
        'audience': 'mail.myfavouritesandwich.org'
      })
      https.request({
        host: 'browserid.org',
        port: 443,
        path: '/verify',
        method: 'POST',
        headers: {
          'Content-Length': postData.length,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }, function(res) {
        console.log('STATUS: '+res.statusCode)
        console.log('HEADERS: '+JSON.stringify(res.headers))
        res.setEncoding('utf8')
        var resultStr = '';
        res.on('data', function(chunk) {
          console.log('BODY: '+chunk)
          resultStr += chunk
        })
        res.on('end', function() {
          var result = JSON.parse(resultStr)
          if(result.status == 'okay') {
            function onCheckUser(verdict) {
              if(verdict) {
                cb(data)
              }
            }
            checkUser(data.emailAddress, result.email, true, onCheckUser)
          }
        })
      }).on('error', function(e) {
        console.log('problem with request: '+e.message)
      }).write(postData)
    }
  }
  return {
    checkCredentials: checkCredentials
  }
})()

io.listen(8000).sockets.on('connection', function(socket) {
  socket.on('setup', function(data) {
    users.checkCredentials(data, function(data) {
      browsermail.addForward(data.emailAddress, socket)
    })
  })
})

