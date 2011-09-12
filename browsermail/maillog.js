(function() {
  require('smtp').createServer(function(connection) {
    connection.on('DATA', function(message) {
      message.on('data', function(data) {
        console.log('DATA:'+ data)
      })
      message.on('end', function() {
        console.log('END')
      })
    })
  }).listen(25)
})()
