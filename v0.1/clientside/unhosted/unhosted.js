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
	function makeCreateCommand(token, app, pub) {
		return JSON.stringify({'method':'CREATE', 'token':token, 'app':app, 'pub':pub});
	}


	// Perform raw private operation on "x": return x^d (mod n)
	function RSADoPrivate(x, p, q, n, d, dmp1, dmq1, coeff) {
		if(p == null || q == null)
			return x.modPow(d, n);

		// TODO: re-calculate any missing CRT params
		var xp = x.mod(p).modPow(dmp1, p);
		var xq = x.mod(q).modPow(dmq1, q);

		while(xp.compareTo(xq) < 0)
			xp = xp.add(p);
		return xp.subtract(xq).multiply(coeff).mod(p).multiply(q).add(xq);
	}

	function makePubSign(nick, cmd) {
    		var qs = 512>>1;
		var e = parseInt("10001", 16);
		var ee = new BigInteger("10001", 16);
		var p = new BigInteger();	p.fromString(keys[nick]["p"], 16);
		var q = new BigInteger();	q.fromString(keys[nick]["q"], 16);
	        var p1 = p.subtract(BigInteger.ONE);
	        var q1 = q.subtract(BigInteger.ONE);
	        var phi = p1.multiply(q1);
		var n = p.multiply(q);
		var d = ee.modInverse(phi);
       		var dmp1 = d.mod(p1);
		var dmq1 = d.mod(q1);
		var coeff = q.modInverse(p);i

		var sHashHex = sha1.hex(cmd);

		var sMid = "";
		var fLen = (n.bitLength() / 4) - sHashHex.length - 6;
		for (var i = 0; i < fLen; i += 2) {
			sMid += "ff";
		}
		hPM = "0001" + sMid + "00" + sHashHex;
		var biPaddedMessage = new BigInteger(hPM, 16);
		var biSign = RSADoPrivate(biPaddedMessage, p, q, n, d, dmp1, dmq1, coeff);
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
		n = new BigInteger();	n.fromString(keys[nick]["pubkey"], 16);
		x = new BigInteger(PubSign.replace(/[ \n]+/g, ""), 16);
		return (x.modPowInt(parseInt("10001", 16), n).toString(16).replace(/^1f+00/, '') == sha1.hex(cmd));
	}
	//public:
	obj.createPub = function(nick, app, cloud, token) {
		key = {};
		key.p="f4f21695f3fb8746d0ccfd34f840d0ab9729bf242cea067d227ea4e26c8d8081";
		key.q="835f4c07fa0dd982f50fffe8d9f1a125c06536239d9467c9520e1df80a40a7d1";
		key.pubkey="7db310249e140d90e09ab3108a13b4fabf89e9996ef98f43a147dbc312a66a9cf3863ee23d532960f56b693541b569c7a981cf2bb7d2f098617e1608189a1051";
		key.seskey="27069632223826919491639745776265";
		keys[nick]=key;
		var cmd = makeCreateCommand(token, app, key.pubkey);
		var PubSign = makePubSign(nick, cmd);
		sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
		return key;
	}
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
