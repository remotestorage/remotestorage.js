function Unhosted() {
	var obj={};
	//private:
	var keys={};
	function makeKey(nick, path) {
		return keys[nick]["app"] + encodeURIComponent("+") + keys[nick]["pubkey"] + "@" + keys[nick]["cloud"] + "/" + path;
	}
	function makeSetCommand(key, value) {
		return JSON.stringify({'method':'SET', 'key':key, 'value':value});
	}
	function makeGetCommand(key) {
		return JSON.stringify({'method':'GET', 'key':key});
	}
	function makePubSign(pri, cmd) {//TODO: implement
		return "WUqC429uHktJurDsQJbKY-Pl9KaGYqofygvY0ky1cmOoZjdn9uCIELKvoI2IQzbG5EnBs9HmP1y06RAxVuAYZLgnkn0DsmRckDOeb6yOkWZ5hTXKYPnaDffdhFqM0S2jVfz7wLdotnciUN1MOa_Xc5Tk6hxWKANqivLbbcgz7BA";
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
	obj.importPub = function(writeCaps, nick) {
		keys[nick]=writeCaps;
	}
	obj.get = function get(nick, path) {
		var cmd = makeGetCommand(makeKey(nick, path));
		return sendPost("protocol=UJ/0.1&cmd="+cmd);
	}
	obj.set = function set(nick, path, value) {
		var cmd = makeSetCommand(makeKey(nick, path), value);
		var PubSign = makePubSign('pri', cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	//
	return obj;
}
