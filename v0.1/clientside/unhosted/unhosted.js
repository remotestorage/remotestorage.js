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
	function makeRsaFromPubNick(nick) {
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

	function makeRsaFromSubNick(nick) {
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
		var rsa = makeRsaFromPubNick(nick);
		var sHashHex = sha1.hex(cmd);

		var sMid = "";
		var fLen = (rsa.n.bitLength() / 4) - sHashHex.length - 6;
		for (var i = 0; i < fLen; i += 2) {
			sMid += "ff";
		}
		hPM = "0001" + sMid + "00" + sHashHex;
		var biPaddedMessage = parseBigInt(hPM, 16);
		var biSign = rsa.doPrivate(biPaddedMessage);
		var hexSign = biSign.toString(16);
		return hexSign;
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
		var rsa = makeRsaFromSubNick(nick);
		return (parseBigInt(PubSign.replace(/[ \n]+/g, ""), 16).modPowInt(rsa.e, rsa.n).toString(16).replace(/^1f+00/, '') == sha1.hex(cmd));
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
			return byteArrayToString(rijndaelDecrypt(hexToByteArray(ret.cmd.value), hexToByteArray(keys[nick]["seskey"]), 'ECB'));
		} else {
			return "ERROR - PubSign "+sig+" does not correctly sign "+cmdStr+" for key "+keys[nick]["pubkey"];
		}
	}
	obj.set = function set(nick, path, value) {
		var cmd = makeSetCommand(makeKey(nick, path), byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(keys[nick]["seskey"]), 'ECB')));
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	//
	return obj;
}
