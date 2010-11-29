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
	function makeRsa(nick) {
		var rsa = new RSAKey();
    		var qs = 512>>1;
		rsa.e = parseInt("10001", 16);
		var ee = new BigInteger("10001", 16);
		rsa.p = new BigInteger();
		rsa.q = new BigInteger();
		rsa.p.fromString(keys[nick]["p"], 16);
		rsa.q.fromString(keys[nick]["q"], 16);
	        var p1 = rsa.p.subtract(BigInteger.ONE);
	        var q1 = rsa.q.subtract(BigInteger.ONE);
	        var phi = p1.multiply(q1);
		rsa.n = rsa.p.multiply(rsa.q);
		rsa.d = ee.modInverse(phi);
       		rsa.dmp1 = rsa.d.mod(p1);
		rsa.dmq1 = rsa.d.mod(q1);
		rsa.coeff = rsa.q.modInverse(rsa.p);
		return rsa;
	}

	function makePubSign(nick, cmd) {
		rsa = makeRsa(nick);
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
		var rsa = makeRsa(nick);
		var sig = rsa.verifyString(cmd, PubSign);
		return sig;
	}
	function myEncrypt(plaintext, nick) {
		pwd = keys[nick]["seskey"];
		return byteArrayToHex(rijndaelEncrypt(plaintext, hexToByteArray(pwd), 'ECB'));
	}
	function myDecrypt(ciphertext, nick) {
		pwd = keys[nick]["seskey"];
		return byteArrayToString(rijndaelDecrypt(hexToByteArray(ciphertext), hexToByteArray(pwd), 'ECB'));
	}
	//public:
	obj.importPub = function(writeCaps, nick) {
		keys[nick]=writeCaps;
	}
	obj.get = function(nick, path) {
		var cmd = makeGetCommand(makeKey(nick, path));
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd));
		var cmdStr = JSON.stringify(ret.cmd).replace("+", "%2B");
		var sig = ret.PubSign;
		if(checkPubSign(cmdStr, sig, nick) == true) {
			return myDecrypt(ret.cmd.value, nick);
		} else {
			return "ERROR - PubSign "+sig+" does not correctly sign "+cmdStr+" for key "+keys[nick]["pubkey"];
		}
	}
	obj.set = function set(nick, path, value) {
		var cmd = makeSetCommand(makeKey(nick, path), myEncrypt(value, nick));
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	//
	return obj;
}
