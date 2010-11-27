function myEncrypt(plaintext, pwd) {
  return byteArrayToHex(rijndaelEncrypt(plaintext, hexToByteArray(pwd), 'ECB'));
}
function myDecrypt(ciphertext, pwd) {
  return byteArrayToString(rijndaelDecrypt(hexToByteArray(ciphertext), hexToByteArray(pwd), 'ECB'));
}
function generateKeyTriplet(pwd) {
  var rsa = new RSAKey();
  rsa.generate(512, "10001");
  var rng = new SecureRandom();
  var ses = genkey();
  var pri = '{"n":"'+rsa.n.toString(16)+'", "d":"'+rsa.d.toString(16)+'"}';
  var cpri = myEncrypt(pri, pwd);
  var pub = '{"n":"'+rsa.n.toString(16)+'", "e":"'+rsa.e.toString(16)+'"}';
  var cses = myEncrypt(ses, pwd);
  return [cpri, pub, cses];
}
function sign(dataHash, priJson) {
  var pri = JSON.parse(priJson);
  var n = new BigInteger(pri.n);
  var d = new BigInteger(pri.d);
  var m = pkcs1pad2(dataHash,(n.bitLength()+7)>>3);
  if(m == null) return null;
  var c = m.modPowInt(d, n);
  if(c == null) return null;
  var h = c.toString(16);
  if((h.length & 1) == 0) return h; else return "0" + h;
}

function makePubSign(data, cpri, pub, cses, pwd) {
  var pri = myDecrypt(cpri, pwd);
  var ses = myDecrypt(cses, pwd);
  var cdata = myEncrypt(data, ses);
  var sig = sign('{"pub":"'+pub+'", "message":"'+data+'"}', pri);
  return '{"pub":"'+pub+'", "message":"'+data+'", "sign":"'+sig+'"}';
  //JSON.parse(myJSONtext, reviver);
}
function createNewChannel(nick) {
	var pwd = genkey();
	var keyTriplet = generateKeyTriplet(pwd);
	var cpri = keyTriplet[0];
	var pub = keyTriplet[1];
	var cses = keyTriplet[2];
 	sendCreateCloudCommand(nick, cpri, pub, cses);
	return pwd;
}
function sendCreateCloudCommand(nick, cpri, pub, cses) {
	xmlhttp=new XMLHttpRequest();
	xmlhttp.onreadystatechange=function() {
	  if (xmlhttp.readyState==4 && xmlhttp.status==200) {
	    document.getElementById("myDiv2").innerHTML=xmlhttp.responseText;
	  }
	}
//	xmlhttp.open("POST","http://locahost:8124/",false);
	xmlhttp.open("POST","http://demo.unhosted.fazebook.org/c",true);
	xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xmlhttp.send("cmd=createChannel&nick="+nick+"&cpri="+cpri+"&pub="+pub+"&cses="+cses);
}
function sendFetchKeysCommand(nick) {
	xmlhttp=new XMLHttpRequest();
//	xmlhttp.open("POST","http://locahost:8124/",false);
	xmlhttp.open("POST","http://demo.unhosted.fazebook.org/f",false);
	xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xmlhttp.send("cmd=fetchKeys&nick="+nick);
	    document.getElementById("myDiv2").innerHTML=xmlhttp.responseText;
	return xmlhttp.responseText;
}
function sendSetCommand(pub, cCmd, shcCmd) {
	xmlhttp=new XMLHttpRequest();
//	xmlhttp.open("POST","http://locahost:8124/",false);
	xmlhttp.open("POST","http://demo.unhosted.fazebook.org/s",false);
	xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xmlhttp.send("cmd=PubSign&channel="+pub+"&message="+cCmd+"&sign="+shcCmd);
	return xmlhttp.responseText;
}
function sendGetCommand(key) {
	xmlhttp=new XMLHttpRequest();
//	xmlhttp.open("POST","http://locahost:8124/",false);
	xmlhttp.open("POST","http://demo.unhosted.fazebook.org/g",false);
	xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xmlhttp.send("cmd=GET&key="+key);
	    document.getElementById("myDiv2").innerHTML=xmlhttp.responseText;
	return xmlhttp.responseText;
}

function unhostData(nick,pwd,key,val) {
  var keysJson = sendFetchKeysCommand(nick);
  var keys = JSON.parse(keysJson);
  var pri = myDecrypt(keys.cpri, pwd);
  var ses = myDecrypt(keys.cses, pwd);
  var commandJson = '{"cmd":"SET", "key":"'+key+'", "val":"'+val+'"}';
  var cCmd = myEncrypt(commandJson, ses);
  var hcCmd = Sha1.hash(cCmd, false);
  var shcCmd = sign(hcCmd, pri);
  var response = sendSetCommand(keys.pub, cCmd, shcCmd);
  return response;
}
function retrieveUnhostedData(nick,pwd,key) {
  var keysJson = sendFetchKeysCommand(nick);
  var keys = JSON.parse(keysJson);
  var ses = myDecrypt(keys.cses, pwd);
  var res = sendGetCommand(key);
  var cmsg = JSON.parse(sendGetCommand(key)).message;
  var msg = myDecrypt(cmsg, ses);
	    document.getElementById("myDiv3").innerHTML=msg;
  return JSON.parse(msg).val;
}
//function genKeyTriplet(pwd) //returns cpri,pub,cses
//function makePubSign(data, cpri, cses, pwd) //returns PubSign post vars
//function openPubSign(pubSign, pub, ses) //returns original data

//document.domain='fazebook.org'
