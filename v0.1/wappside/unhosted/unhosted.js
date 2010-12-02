function Unhosted() {
	//private:
	var keys={};

	// Perform raw private operation on "x": return x^d (mod n)
	function RSASign(sHashHex, nick) {//this function copied from the rsa.js script included in Tom Wu's jsbn
		//generate some interesting numbers from p and q:
		var qs = 512>>1;	var e = parseInt("10001", 16);	var ee = new BigInteger("10001", 16);
		var p = new BigInteger();	p.fromString(keys[nick]["p"], 16);
		var q = new BigInteger();	q.fromString(keys[nick]["q"], 16);
	        var p1 = p.subtract(BigInteger.ONE);	var q1 = q.subtract(BigInteger.ONE);
	        var phi = p1.multiply(q1);	var n = p.multiply(q);	var d = ee.modInverse(phi);
       		var dmp1 = d.mod(p1);	var dmq1 = d.mod(q1);	var coeff = q.modInverse(p);i


		var sMid = "";	var fLen = (n.bitLength() / 4) - sHashHex.length - 6;
		for (var i = 0; i < fLen; i += 2) {
			sMid += "ff";
		}
		hPM = "0001" + sMid + "00" + sHashHex;//this pads the hash to desired length - not entirely sure whether those 'ff' should be random bytes for security or not
		var x = new BigInteger(hPM, 16);//turn the padded message into a jsbn BigInteger object
		if(p == null || q == null)
			return x.modPow(d, n);

		// TODO: re-calculate any missing CRT params
		var xp = x.mod(p).modPow(dmp1, p);
		var xq = x.mod(q).modPow(dmq1, q);

		while(xp.compareTo(xq) < 0)
			xp = xp.add(p);
		return xp.subtract(xq).multiply(coeff).mod(p).multiply(q).add(xq);
	}

	function makePubSign(nick, cmd) {//this function based on the rsa.js script included in Tom Wu's jsbn and rsa-sign.js by [TODO: look up name of Japanese wikitl.jp(?)]
		var sHashHex = sha1.hex(cmd);//this uses sha1.js to generate a sha1 hash of the command
		var biSign = RSASign(sHashHex, nick);//sign it using the function above
		var hexSign = biSign.toString(16);//turn into HEX representation for easy displaying, posting, etcetera. Changing this to base64 would be 33% shorter; worth it?
		return hexSign;
	}
	function sendPost(post) {//this function implements synchronous AJAX to demo.unhosted.org. [TODO: allow for other cloud names]
		xmlhttp=new XMLHttpRequest();
		//xmlhttp.open("POST","http://demo.unhosted.org/",false);
		xmlhttp.open("POST","http://demo.unhosted.org/git/unhosted/v0.1/cloudside/unhosted.php",false);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send(post);
		return xmlhttp.responseText;
	}
	function checkPubSign(cmd, PubSign, nick) {//check a signature. based on rsa-sign.js. uses Tom Wu's jsbn library.
		n = new BigInteger();	n.fromString(keys[nick]["pubkey"], 16);
		x = new BigInteger(PubSign.replace(/[ \n]+/g, ""), 16);
		return (x.modPowInt(parseInt("10001", 16), n).toString(16).replace(/^1f+00/, '') == sha1.hex(cmd));
	}

	//public:
	this.importPub = function(writeCaps, nick) {//import a (pub) key to the keys[] variable
		keys[nick]=writeCaps;
	}
	this.importSub = function(readCaps, nick) {//import a (sub) key to the keys[] variable
		keys[nick]=readCaps;
	}
	this.get = function(nick, keyPath) {//execute a UJ/0.1 GET command
		var cmd = JSON.stringify({"method":"GET", "chan":keys[nick]["r"], "keyPath":keyPath});
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd));
		if(ret==null) {
			return null;
		}
		var cmdStr = JSON.stringify(ret.cmd).replace("+", "%2B");
		var sig = ret.PubSign;
		if(checkPubSign(cmdStr, sig, nick) == true) {
			return byteArrayToString(rijndaelDecrypt(hexToByteArray(ret.cmd.value), hexToByteArray(keys[nick]["seskey"]), 'ECB'));
		} else {
			return "ERROR - PubSign "+sig+" does not correctly sign "+cmdStr+" for key "+keys[nick]["pubkey"];
		}
	}
	this.set = function(nick, keyPath, value) {//execute a UJ/0.1 SET command
		var encr = byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(keys[nick]["seskey"]), 'ECB'));
		var cmd = JSON.stringify({"method":"SET", "chan":keys[nick]["r"], "keyPath":keyPath, "value":encr});
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign+'&WriteCaps='+keys[nick]["w"]);
	}
	this.send = function(nick, keyPath, value) {//execute a UJ/0.1 SEND command
		var encr = byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(keys[nick]["seskey"]), 'ECB'));
		var cmd = JSON.stringify({"method":"SEND", "chan":keys[nick]["r"], "keyPath":keyPath, "value":encr});
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign);
	}
	this.receive = function(nick, keyPath) {//execute a UJ/0.1 GET command
		var cmd = JSON.stringify({"method":"RECEIVE", "chan":keys[nick]["r"], "keyPath":keyPath});
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd+'&WriteCaps='+keys[nick]["w"]));
		if(ret==null) {
			return null;
		}
		var res = '["';
		for(msg in ret) {
			var cmdStr = JSON.stringify(ret[msg].cmd).replace("+", "%2B");
			var sig = ret[msg].PubSign;
//			if(checkPubSign(cmdStr, sig, nick) == true) {//this signature is from the sender, who has not been identified yet. work out how to do this. guids?
				res = res+'","'+byteArrayToString(rijndaelDecrypt(hexToByteArray(ret[msg].cmd.value), hexToByteArray(keys[nick]["seskey"]), 'ECB'));
//			} else {
//				res = res+'","ERROR - PubSign '+sig+' does not correctly sign '+cmdStr+' for key '+keys[nick]["pubkey"];
//			}
		}
		return JSON.parse(res+'"]');//have to find the proper way of doing foo[] = bar;
	}
	return this;
}
