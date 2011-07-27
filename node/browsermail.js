var io = require('socket.io')
  , smtp = require('smtp')

var browsermail = (function() {
  var sockets = {}
  smtp.createServer(function(connection) {
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

io.listen(8000).sockets.on('connection', function(socket) {
  socket.on('setup', function(data) {
    //users.checkCredentials(data, function(data) {
      browsermail.addForward(data.emailAddress, socket)
    //})
  })
})
