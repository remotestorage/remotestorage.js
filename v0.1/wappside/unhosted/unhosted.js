function Unhosted() {
	//private:
	var keys={};//each one should contain fields r,c,n[,s[,d]] (r,c in ASCII; n,s,d in HEX)
	var rng = new SecureRandom();//for padding

	function RSASign(sHashHex, nick) {//this function copied from the rsa.js script included in Tom Wu's jsbn library
		var n = new BigInteger();	n.fromString(keys[nick].n, 16);
		var sMid = "";	var fLen = (n.bitLength() / 4) - sHashHex.length - 6;
		for (var i = 0; i < fLen; i += 2) {
			sMid += "ff";
		}
		hPM = "0001" + sMid + "00" + sHashHex;//this pads the hash to desired length - not entirely sure whether those 'ff' should be random bytes for security or not
		var x = new BigInteger(hPM, 16);//turn the padded message into a jsbn BigInteger object
		var d = new BigInteger();	d.fromString(keys[nick].d, 16);
		return x.modPow(d, n);
	}
	// PKCS#1 (type 2, random) pad input string s to n bytes, and return a bigint
	function pkcs1pad2(s,n) {//copied from the rsa.js script included in Tom Wu's jsbn library
		if(n < s.length + 11) {
			alert("Message too long for RSA");
			return null;
		}
		var ba = new Array();
		var i = s.length - 1;
		while(i >= 0 && n > 0) ba[--n] = s.charCodeAt(i--);
		ba[--n] = 0;
		var x = new Array();
		while(n > 2) { // random non-zero pad
			x[0] = 0;
			while(x[0] == 0) rng.nextBytes(x);
			ba[--n] = x[0];
		}
		ba[--n] = 2;
		ba[--n] = 0;
		return new BigInteger(ba);
	}

	// Undo PKCS#1 (type 2, random) padding and, if valid, return the plaintext
	function pkcs1unpad2(d,n) {//copied from the rsa.js script included in Tom Wu's jsbn library
		var b = d.toByteArray();
		var i = 0;
		while(i < b.length && b[i] == 0) ++i;
		if(b.length-i != n-1 || b[i] != 2)
			return null;
		++i;
		while(b[i] != 0)
			if(++i >= b.length) return null;
		var ret = "";
		while(++i < b.length)
			ret += String.fromCharCode(b[i]);
		return ret;
	}

	// Return the PKCS#1 RSA encryption of "text" as an even-length hex string
	function RSAEncrypt(text, nick) {//copied from the rsa.js script included in Tom Wu's jsbn library
		var n = new BigInteger();	n.fromString(keys[nick].n, 16);
		var m = pkcs1pad2(text,(n.bitLength()+7)>>3);	if(m == null) return null;
		var c = m.modPowInt(parseInt("10001", 16), n);	if(c == null) return null;
		var h = c.toString(16);	
		if((h.length & 1) == 0) return h; else return "0" + h;
	}

	// Return the PKCS#1 RSA decryption of "ctext".
	// "ctext" is an even-length hex string and the output is a plain string.
	function RSADecrypt(ctext, nick) {//copied from rsa.js script included in Tom Wu's jsbn library
		var c = new BigInteger(ctext, 16);
		var n = new BigInteger();	n.fromString(keys[nick].n, 16);
		var d = new BigInteger();	d.fromString(keys[nick].d, 16);
		var m = c.modPow(d, n);
		if(m == null) return null;
		return pkcs1unpad2(m, (n.bitLength()+7)>>3);
	}

	function makePubSign(nick, cmd) {//this function based on the rsa.js script included in Tom Wu's jsbn and rsa-sign.js by [TODO: look up name of Japanese wikitl.jp(?)]
		var sHashHex = sha1.hex(cmd);//this uses sha1.js to generate a sha1 hash of the command
		var biSign = RSASign(sHashHex, nick);//sign it using the function above
		var hexSign = biSign.toString(16);//turn into HEX representation for easy displaying, posting, etcetera. Changing this to base64 would be 33% shorter; worth it?
		return hexSign;
	}
	function sendPost(post, cloud) {//this function implements synchronous AJAX to demo.unhosted.org. [TODO: allow for other cloud names]
		xmlhttp=new XMLHttpRequest();
		//xmlhttp.open("POST","http://demo.unhosted.org/",false);
		xmlhttp.open("POST","http://"+cloud+"/git/unhosted/v0.1/cloudside/unhosted.php",false);
		xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
		xmlhttp.send(post);
		return xmlhttp.responseText;
	}
	function checkPubSign(cmd, PubSign, nick_n) {//check a signature. based on rsa-sign.js. uses Tom Wu's jsbn library.
		var n = new BigInteger();	n.fromString(nick_n, 16);
		var x = new BigInteger(PubSign.replace(/[ \n]+/g, ""), 16);
		return (x.modPowInt(parseInt("10001", 16), n).toString(16).replace(/^1f+00/, '') == sha1.hex(cmd));
	}
	function checkND(n, d) {
		return true;
	}
	function addN(nick, locationN) {
		var n = rawGet(nick, locationN);
		if(n==null) {
			return false;
		}
		n = n.cmd.value;//unpack UJ/0.1 SET command
		if(!checkND(n, keys[nick].d)) {//checks plaintext, PubSign-less n against d
			return false;
		}
		keys[nick].n = n;
		return true;
	}
	function addS(nick, locationS) {
		var ret = unhosted.rawGet(nick, locationS);//decrypts with d instead of with s
		if(ret==null) {
			return false;
		}
		var cmdStr = JSON.stringify(ret.cmd).replace("+", "%2B");
		var sig = ret.PubSign;
		if(checkPubSign(cmdStr, sig, keys[nick].n) == false) {
			return false;
		}
		var ses = RSADecrypt(ret.cmd.ses, nick);//decrypts with d instead of with s
		var s = byteArrayToString(rijndaelDecrypt(hexToByteArray(ret.cmd.value), hexToByteArray(ses), 'ECB'));
		if(s == null) {
			return false;
		}
		keys[nick].s = s;
		return true;
	}
	function makeStar(signerNick, signeeNick) {//creates a star-object for signing
		return {
			"signer":{"r":keys[signerNick].r, "c":keys[signerNick].c, "n":keys[signerNick].n},
			"signee":{"r":keys[signeeNick].r, "c":keys[signeeNick].c, "n":keys[signeeNick].n}
			};
	}
	//public:
	this.importPub = function(writeCaps, nick) {//import a (pub) key to the keys[] variable
		keys[nick]=writeCaps;//this should contain r,c,n,d.
	}
	this.importPubNS = function(writeCaps, nick, locationN, locationS) {
		keys[nick]=writeCaps;//this should contain r,c,w,d.
		return (addN(nick, locationN)==true && addS(nick, locationS)==true);
	}
	this.importSub = function(readCaps, nick) {//import a (sub) key to the keys[] variable
		keys[nick]=readCaps;
	}
	this.rawGet = function(nick, keyPath) {//used by wappbook login bootstrap to retrieve key.n and key.s
		var cmd = JSON.stringify({"method":"GET", "chan":keys[nick].r, "keyPath":keyPath});
		var ret = sendPost("protocol=UJ/0.1&cmd="+cmd, keys[nick].c);
		if(ret == "") {
			return null;
		}
		return JSON.parse(ret);
	}
	this.get = function(nick, keyPath) {//execute a UJ/0.1 GET command
		var ret = rawGet(nick, keyPath);
		if(ret==null) {
			return null;
		}
		var cmdStr = JSON.stringify(ret.cmd).replace("+", "%2B");
		var sig = ret.PubSign;
		if(checkPubSign(cmdStr, sig, keys[nick].n) == true) {
			return JSON.parse(byteArrayToString(rijndaelDecrypt(hexToByteArray(ret.cmd.value), hexToByteArray(keys[nick].s), 'ECB')));
		} else {
			return "ERROR - PubSign "+sig+" does not correctly sign "+cmdStr+" for key "+keys[nick].n;
		}
	}
	this.rawSet = function(nick, keyPath, value, useN) {
		var cmd = JSON.stringify({"method":"SET", "chan":keys[nick].r, "keyPath":keyPath, "value":value});
		var PubSign = '';
		if(useN) {
			//this is two-step encryption. first we Rijndael-encrypt value symmetrically (with the single-use var seskey). The result goes into 'value' in the cmd.
			var bnSeskey = new BigInteger(128,1,rng);//rijndael function we use uses a 128-bit key
			var seskey = bnSeskey.toString(16);
			var encr = byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(seskey), 'ECB'));
			//Then, we RSA-encrypt var seskey asymmetrically with nick's public RSA.n, and that encrypted session key goes into 'ses' in the cmd. See also this.receive.
			var encrSes = RSAEncrypt(seskey, nick);
			cmd = JSON.stringify({"method":"SET", "chan":keys[nick].r, "keyPath":keyPath, "value":encr, "ses":encrSes});
			PubSign = makePubSign(nick, cmd);
		}
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign+'&WriteCaps='+keys[nick].w, keys[nick].c);
	}
	this.set = function(nick, keyPath, value) {//execute a UJ/0.1 SET command
		var encr = byteArrayToHex(rijndaelEncrypt(JSON.stringify(value), hexToByteArray(keys[nick].s), 'ECB'));
		var cmd = JSON.stringify({"method":"SET", "chan":keys[nick].r, "keyPath":keyPath, "value":encr});
		var PubSign = makePubSign(nick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign+'&WriteCaps='+keys[nick].w, keys[nick].c);
	}
	this.send = function(fromNick, toNick, keyPath, value) {//execute a UJ/0.1 SEND command
		//this is two-step encryption. first we Rijndael-encrypt value symmetrically (with the single-use var seskey). The result goes into 'value' in the cmd.
		var bnSeskey = new BigInteger(128,1,rng);//rijndael function we use uses a 128-bit key
		var seskey = bnSeskey.toString(16);
		var encr = byteArrayToHex(rijndaelEncrypt(value, hexToByteArray(seskey), 'ECB'));
		//Then, we RSA-encrypt var seskey asymmetrically with toNick's public RSA.n, and that encrypted session key goes into 'ses' in the cmd. See also this.receive.
		var encrSes = RSAEncrypt(seskey, toNick);
		var cmd = JSON.stringify({"method":"SEND", "chan":keys[toNick].r, "keyPath":keyPath, "value":encr, "ses":encrSes, 
			"SenderSub":{"r":keys[fromNick].r, "c":keys[fromNick].c, "n":keys[fromNick].n}});
		var PubSign = makePubSign(fromNick, cmd);
		return sendPost("protocol=UJ/0.1&cmd="+cmd+"&PubSign="+PubSign, keys[toNick].c);
	}
	this.receive = function(nick, keyPath) {//execute a UJ/0.1 GET command
		var cmd = JSON.stringify({"method":"RECEIVE", "chan":keys[nick].r, "keyPath":keyPath});
		var ret = JSON.parse(sendPost("protocol=UJ/0.1&cmd="+cmd+'&WriteCaps='+keys[nick].w, keys[nick].c));
		if(ret==null) {
			return null;
		}
		var res = [];
		for(msg in ret) {
			var cmdStr = JSON.stringify(ret[msg].cmd).replace("+", "%2B");
			var sig = ret[msg].PubSign;//careful: this PubSign refers to the sender's n (cmd.SenderSub.n), not the receiver's one (keys[nick].n)!
			if(checkPubSign(cmdStr, sig, ret[msg].cmd.SenderSub.n) == true) {
				//now we first need to RSA-decrypt the session key that will let us Rijdael-decrypt the actual value:
				var seskey = RSADecrypt(ret[msg].cmd.ses, nick);
				res.push(JSON.parse(byteArrayToString(rijndaelDecrypt(hexToByteArray(ret[msg].cmd.value), hexToByteArray(seskey), 'ECB'))));
//			} else {
//				res.push({"body":'ERROR - PubSign '+sig+' does not correctly sign '+cmdStr+' for key '+ret[msg].cmd.SenderSub.n, 
//					"SenderSub":{"r":"not valid", "c":"not valid", "n":"not valid"}});
			}
		}
		return res;//have to find the proper way of doing foo[] = bar;
	}
	this.makeStarSign = function(signerNick, signeeNick) {//creates a star-object, signs it, and returns the signature
		var star = makeStar(signerNick, signeeNick);
		var StarSign = makePubSign(signerNick, star);
		return StarSign;
	}
	this.checkStarSign = function(signerNick, signeeNick, StarSign) {//creates a star-object and check the signature against it with the signer's n, or his d if available
		var star = makeStar(signerNick, signeeNick);
		var check = checkPubSign(star, StarSign, keys[signerNick].n);
		return check;
	}
		
	return this;
}
/*GLOBAL SINGLETON:*/
var unhosted = Unhosted();
//public functions:
//	this.importPub = function(writeCaps, nick) {//import a (pub) key to the keys[] variable
//	this.importPubNS = function(writeCaps, nick, locationN, locationS) {
//	this.importSub = function(readCaps, nick) {//import a (sub) key to the keys[] variable

//	this.get = function(nick, keyPath) {//execute a UJ/0.1 GET command
//	this.set = function(nick, keyPath, value) {//execute a UJ/0.1 SET command

//	this.send = function(fromNick, toNick, keyPath, value) {//execute a UJ/0.1 SEND command
//	this.receive = function(nick, keyPath) {//execute a UJ/0.1 GET command

//	this.rawGet = function(nick, keyPath) {//used by wappbook login bootstrap to retrieve key.n and key.s
//	this.rawSet = function(nick, keyPath, value, useN) {

//	this.makeStar = function(signerNick, signeeNick) {//creates a star-object for signing
//	this.makeStarSign = function(signerNick, signeeNick) {//creates a star-object, signs it, and returns the signature
//	this.checkStarSign = function(signerNick, signeeNick, StarSign) {//creates a star-object and check the signature against it with the signer's n, or his d if available

