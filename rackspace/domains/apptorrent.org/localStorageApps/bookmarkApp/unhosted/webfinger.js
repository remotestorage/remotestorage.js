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

			$.ajax({
				url: "http://"+domain+"/.well-known/host-meta",
				cache: false,
				dataType: "xml",
				success: function(xml){
					try {
						$(xml).find('Link').each(function() {
							var rel = $(this).attr('rel');
							if(rel == linkRel) {
								cb($(this).attr('template'));
							}
						});
					} catch(e) {
						onError();
					}
				},
				error: onError
			});
		} else {
			onError();
		}
	}
	var matchLinkRel = function(linkRel, majorDavVersion, minMinorDavVersion) {
		//TODO: do some real reg exp...
		var davVersion;
		if(linkRel == 'http://unhosted.org/spec/dav/0.1') {
			davVersion = {major:0, minor:1};
		} else {
			davVersion = {major:0, minor:0};
		}

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
		} catch(e) {
			onError();
		}
	}
	webFinger.getDavBaseUrl = function(userAddress, majorVersion, minMinorVersion, onError, cb) {
		//get the WebFinger data for the user and extract the uDAVdomain:
		getHostMeta(userAddress, 'lrdd', onError, function(template) {
			$.ajax({
				url: template.replace(/{uri}/, "acct:"+userAddress, true),
				cache: false,
				dataType: "xml",
				success: function(xml){
					try {
						$(xml).find('Link').each(function() {
							if(matchLinkRel($(this).attr('rel'), majorVersion, minMinorVersion)) {
								cb($(this).attr('href'));
								//TODO: should exit loop now that a matching result was found.								
							}
						});
					} catch(e) {
						onError();
					}
				},
				error: onError
			});
		});
	}
	return webFinger;
}
