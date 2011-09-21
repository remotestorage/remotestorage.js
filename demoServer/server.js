var sys = require("sys"),  
    http = require("http"),  
    url = require("url"),  
    path = require("path"),  
    fs = require("fs");  
  
http.createServer(function(req, res) {  
    var uri = url.parse(req.url).pathname;  
    var filename = path.join(process.cwd(), uri);  
    path.exists(filename, function(exists) {  
        if(!exists) {  
            res.writeHead(404, {"Content-Type": "text/plain"});  
            res.end("404 Not Found\n");  
            return;  
        }  
  
        fs.readFile(filename, "binary", function(err, file) {  
            if(err) {  
                res.writeHead(500, {"Content-Type": "text/plain"});  
                res.end(err + "\n");  
                return;  
            }  
  
            res.writeHead(200);  
            res.end(file, "binary");  
        });  
    });  
}).listen(80);  
  
sys.puts("Server running at http://localhost:80/");  
