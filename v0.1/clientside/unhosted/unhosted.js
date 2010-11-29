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
	function makePubSign(nick, cmd) {
		var rsa = new RSAKey();
		rsa.n = new BigInteger(keys[nick]["pubkey"]);
		rsa.d = new BigInteger(keys[nick]["prikey"]);
		
		var sig = rsa.signString(cmd, "sha1");
		return sig;
	}
	function sendPost(post) {
		xmlhttp=new XMLHttpRequest();
		//xmlhttp.open("POST","http://demo.unhosted.org/",false);
		xmlhttp.open("POST","http://demo.unhosted.org/git/unhosted/v0.1/serverside/unhosted.php",false);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send(post);
		return xmlhttp.responseText;
	}
	function checkPubSign(cmd, PubSign, nick) {
		var rsa = new RSAKey();
		rsa.n = new BigInteger(keys[nick]["pubkey"]);
		rsa.e = new BigInteger("AQAB");
		
		var sig = rsa.verifyString(cmd, PubSign);
		return sig;
	}
	//public:
	obj.importPub = function(writeCaps, nick) {
		keys[nick]=writeCaps;
	}
	obj.get = function(nick, path) {
		var cmd = makeGetCommand(makeKey(nick, path));
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd));
		var cmdStr = JSON.stringify(ret.cmd);
		if(checkPubSign(cmdStr, ret.PubSign, nick) == true) {
			return ret.cmd.value;
		} else {
			return "ERROR - PubSign "+ret.PubSign+" does not correctly sign "+cmdStr+" for key "+keys[nick]["pubkey"];
		}
	}
	obj.set = function set(nick, path, value) {
		var cmd = makeSetCommand(makeKey(nick, path), value);
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	//
	return obj;
}
