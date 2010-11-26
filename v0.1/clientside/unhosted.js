function Unhosted() {
	var obj={};
	//private:
	function sendGetCommand(cmd) {
		xmlhttp=new XMLHttpRequest();
		//xmlhttp.open("POST","http://demo.unhosted.org/",false);
		xmlhttp.open("POST","http://localhost/git/unhosted/v0.1/serverside/unhosted.php",false);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send("protocol=UJ/0.1&cmd="+cmd);
		return xmlhttp.responseText;
	}
	function makeGetCommand(key) {
		var cmd = {
			'method':'GET',
			'key':key,
			}
		return JSON.stringify(cmd); 
	}
	//public:
	obj.get = function get(app, pub, cloud, path) {
		key = app + encodeURIComponent("+") + pub + "@" + cloud + "/" + path;
		return sendGetCommand(makeGetCommand(key));
	}
	//
	return obj;
}
