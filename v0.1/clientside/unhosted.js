function Unhosted() {
	var obj={};
	//private:
	function makeKey(app, pub, cloud, path) {
		return app + encodeURIComponent("+") + pub + "@" + cloud + "/" + path;
	}
	function makeSetCommand(key, value) {
		return JSON.stringify({'method':'SET', 'key':key, 'value':value});
	}
	function makeGetCommand(key) {
		return JSON.stringify({'method':'GET', 'key':key});
	}
	function makePubSign(pri, cmd) {//TODO: implement
		return 'Y8N'+encodeURIComponent("+")+'vV3B92iZvhMEPcfXFOsPDvvSUNU514Oaf'+encodeURIComponent("+")+'oKpCOxdniminxNQB5z/NjEqZPDwZphI7EBD7fbIIJGJsqYLWuraA1HjE3axW8bYw1SZ8dZcCDj6iTX2ZpRS/hMCJ4H5iIzM1RdPHN0p5PGQZMm3nubpZW1THzSakXNA6Qui7g=';
	}
	function sendPost(post) {
		xmlhttp=new XMLHttpRequest();
		//xmlhttp.open("POST","http://demo.unhosted.org/",false);
		xmlhttp.open("POST","http://demo.unhosted.org/git/unhosted/v0.1/serverside/unhosted.php",false);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send(post);
		return xmlhttp.responseText;
	}
	//public:
	obj.get = function get(app, pub, cloud, path) {
		var cmd = makeGetCommand(makeKey(app, pub, cloud, path));
		return sendPost("protocol=UJ/0.1&cmd="+cmd);
	}
	obj.set = function set(app, pub, cloud, path, value) {
		var cmd = makeSetCommand(makeKey(app, pub, cloud, path), value);
		var PubSign = makePubSign('pri', cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	//
	return obj;
}
