var Browsermail = function() {
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
}

var b = Browsermail()

require('socket.io').listen(8000).sockets.on('connection', function(socket) {
  b.addForward('advance38@myfavouritesandwich.org', socket)
})

var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')

app.listen(8001);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}
