
function UnhostedDav_0_1(params) {
	var dav = params;
	dav.keyToUrl = function(userAddress, key) {
		var userAddressParts = userAddress.split("@");
		var resource = dav.dataScope;
		var url = dav.davUrl
			+"webdav/"+userAddressParts[1]
			+"/"+userAddressParts[0]
			+"/"+resource
			+"/"+key;
		return url;
	}
	dav.get = function(key, cb) {
		$.ajax({
			url: dav.keyToUrl(dav.userAddress, key), 
				//+ '?ts'+new Date ().getTime ()+'=0', //not compatible with owncloud
			//cache: false, //not compatible with owncloud
			dataType: "text",
			success: function(text){
				cb({success:true, value: text});
			},
			error: function(xhr) {
				if(xhr.status == 404) {
					cb({success:true, value: null});
				} else {
					cb({success:false, error: xhr.status});
				}
			}
		});
	}
	
	dav.set = function(key, text, cb) {
		$.ajax({
			url: dav.keyToUrl(dav.userAddress, key),
			type: "PUT",
			headers: {Authorization: "Basic "+Base64.encode(dav.userAddress +':'+ dav.davToken)},
			fields: {withCredentials: "true"},
			data: text,
			success: function() {cb({success:true});},
			error: function(xhr) {
				cb({success:false, error: xhr.status});
			}
		});
	}
	return dav;
}
