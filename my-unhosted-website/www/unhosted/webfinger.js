  ///////////////
 // Webfinger //
///////////////

var Webfinger = function() {
	var webFinger = {};
	var getHostMeta = function(userAddress, linkRel) {
		//split the userAddress at the "@" symbol:
		var parts = userAddress.split("@");
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
	webFinger.getDavBaseUrl = function(userAddress, majorVersion, minMinorVersion, cb) {
		//get the WebFinger data for the user and extract the uDAVdomain:
		var template = getHostMeta(userAddress, 'lrdd');
		if(template) {
			var xhr = new XMLHttpRequest();
			var url = template.replace(/{uri}/, "acct:"+userAddress, true);
			xhr.open("GET", url, true);
			//WebFinger spec allows application/xml+xrd as the mime type, but we need it to be text/xml for xhr.responseXML to be non-null:
			xhr.overrideMimeType('text/xml');
			xhr.send();
			xhr.onreadystatechange = function() {
				if(xhr.readyState == 4) {
					if(xhr.status == 200) {
				
						//HACK
						var parser=new DOMParser();
						var responseXML = parser.parseFromString(xhr.responseText, "text/xml");
						//END HACK

						var linkElts = responseXML.documentElement.getElementsByTagName('Link');
						var i;
						for(i=0; i < linkElts.length; i++) {
							if(matchLinkRel(linkElts[i].attributes.getNamedItem('rel').value, majorVersion, minMinorVersion)) {
								cb(linkElts[i].attributes.getNamedItem('href').value);
								return;
							}
						}
					}
				}
			}
		}
	}
	webFinger.getAdminUrl = function(userAddress) {
		var template = getHostMeta(userAddress, 'register');
		if(template) {
			return template.replace("\{uri\}",userAddress).replace("\{redirect_url\}", window.location);
		}
		return null;
	}
	return webFinger;
}
