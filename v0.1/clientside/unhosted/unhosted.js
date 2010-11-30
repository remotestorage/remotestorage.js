function Unhosted() {
	var obj={};
	//private:
	var keys={};
	function makeSetCommand(nick, keyPath, value) {
		return JSON.stringify({'method':'SET', 'chan':keys[nick]['chan'], 'keyPath':keyPath, 'value':value});
	}
	function makeGetCommand(nick, keyPath) {
		return JSON.stringify({'method':'GET', 'chan':keys[nick]['chan'], 'keyPath':keyPath});
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

	// Generate a new random private key B bits long, using public expt E
	function RSAGenerate() {
	    var rng = new SecureRandom();
	    var qs = 512>>1;
	    this.e = parseInt("10001",16);
	    var ee = new BigInteger("10001",16);
	    for(;;) {
	        for(;;) {
	            p = new BigInteger(512-qs,1,rng);
	            if(p.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && p.isProbablePrime(10)) break;
	        }
	        for(;;) {
        	    q = new BigInteger(qs,1,rng);
	            if(q.subtract(BigInteger.ONE).gcd(ee).compareTo(BigInteger.ONE) == 0 && q.isProbablePrime(10)) break;
        	}
	        if(p.compareTo(q) <= 0) {
	            var t = p;
	            p = q;
	            q = t;
	        }
	        var p1 = p.subtract(BigInteger.ONE);
	        var q1 = q.subtract(BigInteger.ONE);
	        var phi = p1.multiply(q1);
	        if(phi.gcd(ee).compareTo(BigInteger.ONE) == 0) {
		    bnSeskey=new BigInteger(512-qs,1,rng);
	            return {"p":p.toString(16),"q":q.toString(16),"pubkey":p.multiply(q).toString(16), "seskey":bnSeskey.toString(16)};
	        }
	    }
	}
	//public:
	obj.createPub = function(nick, app, cloud, token) {
		key = RSAGenerate();
		keys[nick]=key;
		var cmd = makeCreateCommand(token, app, key.pubkey);
		var PubSign = makePubSign(nick, cmd);
		sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
		return key;
	}
	obj.importPub = function(writeCaps, nick) {
		keys[nick]=writeCaps;
	}
	obj.get = function(nick, keyPath) {
		var cmd = makeGetCommand(nick, keyPath);
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd));
		var cmdStr = JSON.stringify(ret.cmd).replace("+", "%2B");
		var sig = ret.PubSign;
		if(checkPubSign(cmdStr, sig, nick) == true) {
			return byteArrayToString(rijndaelDecrypt(hexToByteArray(ret.cmd.value), hexToByteArray(keys[nick]["seskey"]), 'ECB'));
		} else {
			return "ERROR - PubSign "+sig+" does not correctly sign "+cmdStr+" for key "+keys[nick]["pubkey"];
		}
	}
	obj.set = function set(nick, keyPath, value) {
		var cmd = makeSetCommand(nick, keyPath, byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(keys[nick]["seskey"]), 'ECB')));
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign+'&pwdChW='+keys[nick]['pwdChW']);
	}
	//
	return obj;
}
