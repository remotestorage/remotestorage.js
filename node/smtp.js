var smtp = require('smtp'),
    redis = require("redis"),
    client = redis.createClient(),
    http = require('http');

var io = require('socket.io').listen(8080);

var tempMailBoxes = {};

//you visit myfavouritesandwich.org, and use it offline. there is no encryption yet. data is stored locally in sessionStorage, to be on the safe side.
//now you log in with a non-unhosted browserid
//webfinger fails, so it offers you to choose a hosted account. you pick a username, it gets sent together with the assertion over a websocket to the smtp bridge.
//if the assertion works out, then you get your mailbox (this relation is stored in redis)
//incoming mail is socketed to your browser.

client.on("error", function (err) {
    console.log("Error " + err)
});

client.set("string key", "string val", redis.print)

smtp.createServer(function(connection) {
    connection.on('DATA', function(message) {
          console.log(JSON.stringify(tempMailBoxes))
       console.log('Message from ' + message.sender.address)
       console.log('Message to ' + message.recipient.address)
       var msgText = ''
       message.on('data', function(data) {
          msgText = msgText+data
          console.log("DATA: " + data)
       })
       message.on('end', function() {
          client.set(message.recipient.address, msgText)
          tempMailBoxes[message.recipient.address](msgText)
          console.log('EOT')
          message.accept()
          client.get(message.recipient.address, function(err, val) {
             console.log(val)
          })
       })
    })
}).listen(25)

var fs = require('fs');

module.exports = function serveJsSetup() {
  return function serveJsHandle(req, res, next) {
    // Serve any file relative to the process.
    // NOTE security was sacrificed in this example to make the code simple.
    fs.readFile(req.url.substr(1), function (err, data) {
      if (err) {
        next(err);
        return;
      }
      res.simpleBody(200, data, "application/javascript");
    });
  };
};

http.createServer(function (req, res) {
   if(req.url == '/socket.io.js') {
   tempMailBoxes.michiel('asdf');
      fs.readFile('socket.io.js', function(err, data) {
         if(err) {
            next(err);
            return
         }
         res.simpleBody(200, data, "application/javascript")
      })
   } else {
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end('<script src="http://50.56.81.142:8080/socket.io/socket.io.js"></script><script>'
      +'var socket = io.connect("http://50.56.81.142:8080/");\n'
      +'socket.on("news", function (data) {\n'
      +'console.log(data);\n'
      +'socket.emit("my other event", { my: "data" });\n'
      +'});'
      +'</script>')
   }
}).listen(80, "50.56.81.142")

function checkBrowserId(assertion) {
// We need this to build our post string
var querystring = require('querystring');
var http = require('http');
var fs = require('fs');

function PostCode(codestring) {
  // Build the post string from an object
  var post_data = querystring.stringify({
      'compilation_level' : 'ADVANCED_OPTIMIZATIONS',
      'output_format': 'json',
      'output_info': 'compiled_code',
        'warning_level' : 'QUIET',
        'js_code' : codestring
  });

  // An object of options to indicate where to post to
  var post_options = {
      host: 'closure-compiler.appspot.com',
      port: '80',
      path: '/compile',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
      }
  };

  // Set up the request
  var post_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });

  // post the data
  post_req.write(post_data);
  post_req.end();

}

// This is an async file read
fs.readFile('LinkedList.js', 'utf-8', function (err, data) {
  if (err) {
    // If this were just a small part of the application, you would
    // want to handle this differently, maybe throwing an exception
    // for the caller to handle. Since the file is absolutely essential
    // to the program's functionality, we're going to exit with a fatal
    // error instead.
    console.log("FATAL An error occurred trying to read in the file: " + err);
    process.exit(-2);
  }
  // Make sure there's data before we post it
  if(data) {
    PostCode(data);
  }
  else {
    console.log("No data to post");
    process.exit(-1);
  }
});

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' })
  socket.on('setup', function (data) {
     var check = checkBrowserId(data.assertion))
     if(check.status == "okay") {
        connectMailbox(data.userName, check.email_address, function(msg) {
           socket.emit('news', msg);
       })
    }
    console.log(data)
  }
})

console.log("SMTP server running on port 25")
