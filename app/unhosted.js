  ///////////////
 // WebFinger //
///////////////

var WebFinger = function() {
	var webFinger = {};
	var getHostMeta = function(userName, linkRel) {
		//split the userName at the "@" symbol:
		var parts = userName.split("@");
		if(parts.length == 2) {
			var user = parts[0];
			var domain = parts[1];

			//get the host-meta data for the domain:
			var xhr = new XMLHttpRequest();
			var url = "http://"+domain+"/.well-known/host-meta";
			xhr.open("GET", url, false);	
			//WebFinger spec allows application/xml+xrd as the mime type, but we need it to be text/xml for xhr.responseXML to be non-null:
			xhr.overrideMimeType('text/xml');
			xhr.send();
			if(xhr.status == 200) {
				
				//HACK
				var parser=new DOMParser();
				var responseXML = parser.parseFromString(xhr.responseText, "text/xml");
				//END HACK

				var hostMetaLinks = responseXML.documentElement.getElementsByTagName('Link');
				var i;
				for(i=0; i<hostMetaLinks.length; i++) {
					if(hostMetaLinks[i].attributes.getNamedItem('rel').value == linkRel) {
						return hostMetaLinks[i].attributes.getNamedItem('template').value;
					}
				}
			}
		}
		return null;
	}
	var matchLinkRel = function(linkRel, majorDavVersion, minMinorDavVersion) {
		//TODO: do some real reg exp...
		var davVersion = {major:0, minor:1};
		
		if(davVersion.major == majorDavVersion) {
			if(majorDavVersion == 0) {//pre-1.0.0, every minor version is breaking, see http://semver.org/
				return (davVersion.minor == minMinorDavVersion);
			} else {//from 1.0.0 onwards, check if available version is at least minMinorDavVersion
				return (davVersion.minor >= minMinorDavVersion);
			}
		} else {
			return false;
		}
	}
	webFinger.getDavDomain = function(userName, majorVersion, minMinorVersion) {
		//get the WebFinger data for the user and extract the uDAVdomain:
		var template = getHostMeta(userName, 'lrdd');
		if(template) {
			var xhr = new XMLHttpRequest();
			var url = template.replace(/{uri}/, "acct:"+userName, true);
			xhr.open("GET", url, false);
			//WebFinger spec allows application/xml+xrd as the mime type, but we need it to be text/xml for xhr.responseXML to be non-null:
			xhr.overrideMimeType('text/xml');
			xhr.send();
			if(xhr.status == 200) {
				
				//HACK
				var parser=new DOMParser();
				var responseXML = parser.parseFromString(xhr.responseText, "text/xml");
				//END HACK

				var linkElts = responseXML.documentElement.getElementsByTagName('Link');
				var i;
				for(i=0; i < linkElts.length; i++) {
					if(matchLinkRel(linkElts[i].attributes.getNamedItem('rel').value, majorVersion, minMinorVersion)) {
						return linkElts[i].attributes.getNamedItem('href').value;
					}
				}
			}
		}
		return null;
	}
	webFinger.getAdminUrl = function(userName) {
		var template = getHostMeta(userName, 'register');
		if(template) {
			return template.replace("\{uri\}",userName).replace("\{redirect_url\}", window.location);
		}
		return null;
	}
	return webFinger;
}


  ///////////////
 // OAuth2-cs //
///////////////

var OAuth = function () {
	var oAuth = {}
	oAuth.dance = function(oAuthDomain, userName, app) {
		window.location = oAuthDomain
					+"oauth2/auth"
					+"?client_id="+app
					+"&redirect_uri="+app
					+"&scope="+document.domain
					+"&response_type=token"
					+"&user_name="+userName;
	}
	oAuth.revoke = function() {
		localStorage.removeItem("OAuth2-cs::token");
	}
	//receive incoming OAuth token, if present:
	oAuth.receiveToken = function() {
		var regex = new RegExp("[\\?&]user_name=([^&#]*)");
		var results = regex.exec(window.location.href);
		if(results) {
			localStorage.setItem("unhosted::userName", results[1]);
			var davDomain = WebFinger().getDavDomain(results[1], 0, 1);
			if(davDomain != null) {
				localStorage.setItem("unhosted::davDomain", davDomain);
				localStorage.setItem("unhosted::isUnhosted", "yes");
			}
		}
		var regex2 = new RegExp("[\\?&]token=([^&#]*)");
		var results2 = regex2.exec(window.location.href);
		if(results2) {
			localStorage.setItem("OAuth2-cs::token", results2[1]);
			window.location = location.href.split("?")[0];
		}
	}
	return oAuth;
}
OAuth().receiveToken();


  /////////
 // DAV //
/////////

var DAV = function() {
	var dav = {}
	var makeBasicAuth = function(user, password) {
		var tok = user + ':' + password;
		var hash = Base64.encode(tok);
		return "Basic " + hash;
	}
	keyToUrl = function(key) {
		var userNameParts = localStorage.getItem("unhosted::userName").split("@");
		var resource = document.domain;
		var url = localStorage.getItem("unhosted::davDomain")
			+"webdav/"+userNameParts[1]
			+"/"+userNameParts[0]
			+"/"+resource
			+"/"+key;
		return url;
	}
	dav.get = function(key) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", keyToUrl(key), false);
		xhr.setRequestHeader("Authorization", makeBasicAuth(localStorage.getItem("unhosted::userName"), localStorage.getItem("OAuth2-cs::token")));
		xhr.withCredentials = "true";
		xhr.send();
		if(xhr.status == 200) {
			return JSON.parse(xhr.responseText);
		} if(xhr.status == 404) {
			return null;
		} else {
			alert("error: got status "+xhr.status+" when doing basic auth GET on url "+keyToUrl(key));
		}
	}
	dav.put = function(key, value) {
		var text = JSON.stringify(value);
		var xhr = new XMLHttpRequest();
		xhr.open("PUT", keyToUrl(key), false);
		xhr.setRequestHeader("Authorization", makeBasicAuth(localStorage.getItem("unhosted::userName"), localStorage.getItem("OAuth2-cs::token")));
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
	unhosted.dav = DAV();

	unhosted.setUserName = function(userName) {
		if(userName == null) {
			localStorage.removeItem("unhosted::userName");
			localStorage.removeItem("unhosted::davDomain");
			localStorage.setItem("unhosted::isConnected", "no");
			OAuth().revoke();
		} else {
			localStorage.setItem("unhosted::userName", userName);
			var davDomain = WebFinger().getDavDomain(userName, 0, 1);
			if(davDomain == null) {
				localStorage.setItem("unhosted::davDomain", localStorage.getItem("unhosted::hostedWebDAV"));
				localStorage.setItem("unhosted::isUnhosted", "no");
				localStorage.setItem("unhosted::isConnected", "yes");
			} else {
				localStorage.setItem("unhosted::davDomain", davDomain);
				localStorage.setItem("unhosted::isUnhosted", "yes");
				localStorage.setItem("unhosted::isConnected", "yes");
			}
		}
	}

	unhosted.getUserName = function() {
		if(localStorage.getItem("unhosted::isConnected") == "yes") {
			if(localStorage.getItem("unhosted::isUnhosted") == "yes") {
				return localStorage.getItem("unhosted::userName").trim();
			} else {
				return localStorage.getItem("unhosted::userName").trim()+" WARNING: YOUR ACCOUNT IS HOSTED AT MYFAVOURITESANDWICH.<BR>PLEASE SEE <a href='https://dev.unhosted.org/register.php?redirect_url=www.myfavouritesandwich.org&scope=www.myfavouritesandwich.org'>HERE</a> ABOUT GETTING AN UNHOSTED ACCOUNT!";
			}
		}
		return null;
	}

	unhosted.setWalletService = function(walletService) {
		localStorage.setItem("unhosted::walletService", walletService);
	}

	unhosted.setHostedWebDAV = function(walletService) {
		localStorage.setItem("unhosted::hostedWebDAV", walletService);
	}

	unhosted.setPassword = function(password) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", 
			localStorage.getItem("unhosted::walletService")
			+"?user_name="+localStorage.getItem("unhosted::userName")
			+"&pwd="+password, false);
		xhr.send();
		if(xhr.status == 200) {
			localStorage.setItem("unhosted::strongPassword", xhr.responseText);
		}
	}
	unhosted.connect = function() {
		var davDomain = localStorage.getItem("unhosted::davDomain");
		var userName = localStorage.getItem("unhosted::userName");
		if((davDomain != null) && (localStorage.getItem("unhosted::isUnhosted") == "yes")) {
			OAuth().dance(davDomain, userName, location.host + location.pathname);
		}
	}
	unhosted.register = function(userName) {
		var registerUrl = WebFinger().getAdminUrl(userName);
		if(registerUrl) {
			window.location = registerUrl;
		} else {
			var parts = userName.split("@");
			if(parts.length == 2) {
				//alert the sys admin about the error through a 404 message to her website:
				var xhr = new XMLHttpRequest();
				var url = "http://www."+parts[1]+"/unhosted-account-failure/?user="+userName;
				xhr.open("GET", url, true);
				xhr.send();

				//inform the user:
				return "Unhosted account not found! Please alert an IT hero at "
					+parts[1]
					+" about this. For alternative providers, see http://www.unhosted.org/";
			} else {
				return "Please use one '@' symbol in the user name";
			}
		}
	}

	return unhosted;
}
