var domainsDir = '/root/unhosted/demoServer/domains/'

var http = require("http"),  
    url = require("url"),  
    path = require("path"),  
    fs = require("fs");  
  
function serve(req, res) {
    var uri = url.parse(req.url).pathname;  
    var filename = path.join(domainsDir, req.headers.host, uri)
    if(filename.substring(0, domainsDir.length) != domainsDir) {
      res.writeHead(403, {"Content-Type": "text/plain"});  
      res.end("403 Naughty!\n");  
      return;  
    }

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
}
var ssl = {
  key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
  cert: fs.readFileSync('test/fixtures/keys/agent2-cert.pem')
};
 
http.createServer(serve).listen(80)
https.createServer(serve).listen(443)
console.log("Server running at ports 80 and 443");  
