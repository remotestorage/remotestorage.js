  ///////////////
 // Webfinger //
///////////////

var Webfinger = function() {
	var webFinger = {};
	var getHostMeta = function(userAddress, linkRel, onError, cb) {
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
			xhr.onreadystatechange = function() {
				if(xhr.readyState == 4) {
					if(xhr.status == 200) {
						try {
							//HACK
							var parser=new DOMParser();
							var responseXML = parser.parseFromString(xhr.responseText, "text/xml");
							//END HACK

							var hostMetaLinks = responseXML.documentElement.getElementsByTagName('Link');
							var i;
							for(i=0; i<hostMetaLinks.length; i++) {
								if(hostMetaLinks[i].attributes.getNamedItem('rel').value == linkRel) {
									cb(hostMetaLinks[i].attributes.getNamedItem('template').value);
									return;
								}
							}
						} catch(e) {
							onError();
						}
					}
					onError();
				}
			}
			xhr.send();
		}
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
	var processLrrd = function(lrrdXml, majorVersion, minMinorVersion, onError, cb) {
		try {
			var linkElts = lrrdXml.documentElement.getElementsByTagName('Link');
			var i;
			for(i=0; i < linkElts.length; i++) {
				if(matchLinkRel(linkElts[i].attributes.getNamedItem('rel').value, majorVersion, minMinorVersion)) {
					cb(linkElts[i].attributes.getNamedItem('href').value);
					return;
				}
			}
		} catch(e) {
			onError();
		}
	}
	webFinger.getDavBaseUrl = function(userAddress, majorVersion, minMinorVersion, onError, cb) {
		//get the WebFinger data for the user and extract the uDAVdomain:
		getHostMeta(userAddress, 'lrdd', onError, function(template) {
			try {
				var xhr = new XMLHttpRequest();
				var url = template.replace(/{uri}/, "acct:"+userAddress, true);
				xhr.open("GET", url, true);
				//WebFinger spec allows application/xml+xrd as the mime type,
				//but we need it to be text/xml for xhr.responseXML to be non-null:
				xhr.overrideMimeType('text/xml');
				xhr.onreadystatechange = function() {
					if(xhr.readyState == 4) {
						if(xhr.status == 200) {
							try {
								//HACK
								var parser = new DOMParser();
								var responseXML = parser.parseFromString(xhr.responseText, "text/xml");
								//END HACK
								processLrrd(responseXML, majorVersion, minMinorVersion, onError, cb);
							} catch(e) {
								onError();
							}
						}
					}
				}
				xhr.send();
			} catch(e) {
				onError();
			}
		});
	}
	return webFinger;
}
