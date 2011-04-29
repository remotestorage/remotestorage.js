// app state shared with login.html:
// =================================
// localStorage::"unhosted".userName
// localStorage::"unhosted".davAuth
// localStorage::"unhosted".cryptoPwd
// localStorage::"unhosted".davBaseUrl


  /////////
 // DAV //
/////////

var DAV = function() {
	var dav = {}
	keyToUrl = function(key, wallet) {
		var userNameParts = wallet.userName.split("@");
		var resource = document.domain;
		var url = wallet.davBaseUrl
			+"webdav/"+userNameParts[1]
			+"/"+userNameParts[0]
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
		xhr.open("PUT", keyToUrl(key, wallet), false);
		xhr.setRequestHeader("Authorization", wallet.davAuth);
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
		if(!getWallet().davAuth) {
			window.location = config.loginUrl;
		}
	}
	unhosted.getUserName = function() {
		return getWallet().userName;
	}
	unhosted.get = function(key) {
		return JSON.parse(dav.get(key));
		//return JSON.parse(sjcl.decrypt(localStorage.getItem("unhosted").cryptoPwd, dav.get(key)));
	}
	unhosted.set = function(key, value) {
		dav.put(key, JSON.stringify(value));
		//dav.put(key, sjcl.encrypt(localStorage.getItem("unhosted").cryptoPwd, JSON.stringify(value)));
	}
	unhosted.close = function() {
		setWallet({});
	}

	return unhosted;
}
