  /////////
 // DAV //
/////////

var DAV = function() {
	var dav = {}
	keyToUrl = function(key, wallet) {
		var userAddressParts = wallet.userAddress.split("@");
		var resource = document.domain;
		var url = wallet.davBaseUrl
			+"webdav/"+userAddressParts[1]
			+"/"+userAddressParts[0]
			+"/"+resource
			+"/"+key;
		return url;
	}
	dav.get = function(key) {
		var wallet = getWallet();
		var xhr = new XMLHttpRequest();
		xhr.open("GET", keyToUrl(key, wallet), false);
		xhr.send();
		if(xhr.status == 200) {
			return xhr.responseText;
		} if(xhr.status == 404) {
			return null;
		} else {
			alert("error: got status "+xhr.status+" when doing basic auth GET on url "+keyToUrl(key));
		}
	}
	
	dav.put = function(key, text) {
		var wallet = getWallet();
		var xhr = new XMLHttpRequest();
		
		//xhr.open("PUT", keyToUrl(key, wallet), false, wallet.userAddress, wallet.davToken);
		//HACK:
		xhr.open("PUT", keyToUrl(key, wallet), false);
		xhr.setRequestHeader("Authorization", "Basic "+Base64.encode(wallet.userAddress +':'+ wallet.davToken));
		//END HACK.

		xhr.withCredentials = "true";
		xhr.send(text);
		if(xhr.status != 200 && xhr.status != 201 && xhr.status != 204) {
			alert("error: got status "+xhr.status+" when doing basic auth PUT on url "+keyToUrl(key));
		}
	}
	return dav;
}


  //////////////
 // Unhosted //
//////////////

var Unhosted = function() {
	var unhosted = {};
	var dav = DAV();
	unhosted.connect = function() {
		if(!getWallet().davToken) {
			window.location = config.loginUrl;
		}
	}
	unhosted.getUserName = function() {
		return getWallet().userAddress;
	}
	unhosted.get = function(key) {
		var wallet = getWallet();
		if(wallet.cryptoPwd == null) {
			return JSON.parse(dav.get(key));
		} else {
			return JSON.parse(sjcl.decrypt(wallet.cryptoPwd, dav.get(key)));
		}
	}
	unhosted.set = function(key, value) {
		var wallet = getWallet();
		if(wallet.cryptoPwd == null) {
			dav.put(key, JSON.stringify(value));
		} else {
			dav.put(key, sjcl.encrypt(wallet.cryptoPwd, JSON.stringify(value)));
		}
	}
	unhosted.close = function() {
		setWallet({});
		window.location = config.loginUrl;
	}

	return unhosted;
}
