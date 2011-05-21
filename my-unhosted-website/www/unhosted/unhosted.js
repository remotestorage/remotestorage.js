  /////////
 // DAV //
/////////

var DAV = function() {
	var dav = {}
	var keyToUrl = function(userAddress, key, wallet) {
		var userAddressParts = userAddress.split("@");
		var resource = config.dataScope;
		var url = wallet.davBaseUrl
			+"webdav/"+userAddressParts[1]
			+"/"+userAddressParts[0]
			+"/"+resource
			+"/"+key;
		return url;
	}
	dav.get = function(userAddress, key, cb) {
		var wallet = getWallet();
		$.ajax({
			url: keyToUrl(userAddress, key, wallet) + '?ts'+new Date ().getTime ()+'=0',
			cache: false,
			dataType: "text",
			success: function(text){
				cb(text);
			},
			error: function(xhr) {
				if(xhr.status == 404) {
					cb(null);
				} else {
					alert("error: got status "+xhr.status+" when doing basic auth GET on url "+keyToUrl(userAddress, key, wallet));
				}
			}
		});
	}
	
	dav.put = function(key, text, cb) {
		var wallet = getWallet();
		$.ajax({
			url: keyToUrl(wallet.userAddress, key, wallet),
			type: "PUT",
			headers: {Authorization: "Basic "+Base64.encode(wallet.userAddress +':'+ wallet.davToken)},
			fields: {withCredentials: "true"},
			data: text,
			success: cb,
			error: function(xhr) {
				alert("error: got status "+xhr.status+" when doing basic auth PUT on url "+keyToUrl(wallet.userAddress, key, wallet));
			}
		});
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
	unhosted.getMode = function() {
		if(getWallet().userAddress.split('@')[1] == config.homeDomain) {
			return 'home';
		} else if(getWallet().cryptoPwd == undefined) {
			return 'clear';
		} else {
			return 'crypto';
		}
	}
	unhosted.setCryptoPwd = function(cryptoPwd, onDoesntExist, onOtherError, onSuccess) {
		if(onDoesntExist == null) {
			allowCreation = "true";
		} else {
			allowCreation = "false";
		}
		var wallet = getWallet();
		$.ajax({
			url: config.doUrl,
			type: "POST",
			data: {
				action: "getWallet",
				userAddress: wallet.userAddress,
				pwd: cryptoPwd,
				dataScope: config.dataScope,
				allowCreation: allowCreation
			},
			success: function(text) {
				try {	
					var wallet2 = JSON.parse(text);
					wallet.cryptoPwd = wallet2.cryptoPwd;
					setWallet(wallet);
					onSuccess();
				} catch(e) {
					onOtherError();
				}
			},
			error: function(xhr) {
				if(xhr.status == 404) {
					onDoesntExist();
				} else {
					onOtherError();
				}
			}
		});
	}
	unhosted.get = function(key, requirePwd, cb) {
		var wallet = getWallet();
		return unhosted.getOther(wallet.userAddress, key, requirePwd, cb);
	}
	unhosted.getOther = function(userAddress, key, requirePwd, cb) {
		var wallet = getWallet();
		if(wallet.cryptoPwd == undefined) {
			dav.get(userAddress, key, function(str) {
				try {
					cb(JSON.parse(str));
				} catch(e) {
					requirePwd();
				}
			});
		} else {
			dav.get(userAddress, key, function(str) {
				if(str == null) {
					cb(null);
				} else {
					cb(JSON.parse(sjcl.decrypt(wallet.cryptoPwd, str)));
				}
			});
		}
	}
	unhosted.set = function(key, value, cb) {
		var wallet = getWallet();
		if(wallet.cryptoPwd == undefined) {
			dav.put(key, JSON.stringify(value), cb);
		} else {
			dav.put(key, sjcl.encrypt(wallet.cryptoPwd, JSON.stringify(value)), cb);
		}
	}
	unhosted.close = function() {
		setWallet({});
		window.location = config.loginUrl;
	}

	return unhosted;
}
