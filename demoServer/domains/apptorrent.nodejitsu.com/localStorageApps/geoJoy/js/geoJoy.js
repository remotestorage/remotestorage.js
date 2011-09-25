/*
geoJoy by Claim Soluciones, S.C.P. is licensed under a GNU General Public License, version 3 (GPL v3).
Permissions beyond the scope of this license may be available at http://www.claimsoluciones.com.
License Info: http://www.opensource.org/licenses/gpl-3.0.html
*/
function loadItem(key, name, type, lat, lng) {
	$('.itemList_li').remove();
	$('#itemList_map').remove();
	var capType = type.charAt(0).toUpperCase() + type.slice(1);
	$('#itemListName').after('<li class="itemList_li">'+name+'</li>');
	$('#itemListType').after('<li class="itemList_li">'+capType+'</li>');
	imageURL = "http://maps.google.com/maps/api/staticmap?sensor=false&center=" + lat + ',' + lng+"&zoom=15&size=280x280&markers=color:blue|" + lat + ',' + lng;
	$('#itemListMap').append('<img src="'+imageURL+'" id="itemList_map" alt="Google Map">');
	document.getElementById('itemKey').value = key;
	$('#item2Del').append(document.createTextNode(name));
	document.getElementById('itemKey2Del').value = key;
}

function deleteItem() {
	var key = document.getElementById('itemKey2Del').value;
	localStorage.removeItem(key);
	window.location.reload();
	window.location.href="../index.html";
}

function mngLink() {
	loadItem(this.key, this.name, this.type, this.lat, this.lng);
}

function getStorageQty() {
	var storageQty = localStorage.length;
	$('#storageQty').append(document.createTextNode(storageQty));
	if (storageQty === 0) {
		$('#geoMessage').append('<p id="itemsMessage"><strong>You do not have location items saved in your phone. Start by creating new items.</strong></p>');
		return true;
	} else {
		var types = [];
		var items = [];
		for (var i = 0; i < storageQty; i++) {
			var key = localStorage.key(i);
			var item = localStorage.getItem(key);
			item = item.split('&;&');
			var name = item[0];
			var type = item[1];
			var coord = item[2];
			coord = coord.split(',');
			var lat = coord[0];
			var lng = coord[1];
			if (types[type] !== true) {
				$('#'+type).show();
				types[type] = true;
			}
			var element = document.createElement('li');
			element.innerHTML = '<a href="#itemView">'+name+'</a>';
			element.key = key;
			element.name = name;
			element.type = type;
			element.lat = lat;
			element.lng = lng;
			element.onclick = mngLink;
			$('#'+type).after(element);
		}
		return true;
	}
}

function deleteAll() {
	localStorage.clear();
	window.location.reload();
	window.location.href="../index.html";
}

function handlePosition(position) {
	var lat = position.coords.latitude;
	var lng = position.coords.longitude;
	var dateId = new Date();
	var itemId = dateId.getTime();
	document.getElementById('itemId').value = itemId;
	document.getElementById('coordinates').value = lat + ',' + lng;
	var imageURL = "http://maps.google.com/maps/api/staticmap?sensor=true&center=" + lat + ',' + lng+"&zoom=15&size=260x100&markers=color:blue|" + lat + ',' + lng;
	$('#mapImage').empty();
	$('#mapImage').append('<img src="'+imageURL+'" alt="Google Map">');
	if (document.getElementById('clearSaveButtons').style.display === 'none') {
		$('#clearSaveButtons').fadeIn('slow');
		$('#geoButton').fadeOut('slow');
	}
	return true;
}
		
function handleErrors(error) {
	switch(error.code) {
		case error.PERMISSION_DENIED: alert('User did not allow geoLocation.');
		break;
				
		case error.POSITION_UNAVAILABLE: alert('Position is not acquirable.');
		break;
				
		case error.TIMEOUT: alert('Position retrieval timed out.');
		break;
				
		default: alert('Unknown Error');
		break;
	}
	return true;
}
function getGeo() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(handlePosition, handleErrors, {enableHighAccuracy: true, maximumAge: 0});
	}
	return true;
}

function saveItem() {
	if (typeof(localStorage) !== 'undefined') {
		try {
			var itemId = document.getElementById('itemId').value;
			var values = [];
			values.push(document.getElementById('nameInput').value);
			values.push(document.getElementById('selectType').value);
			values.push(document.getElementById('coordinates').value);
			localStorage.setItem(itemId, values.join('&;&'));
			delete values;
			delete dateId;
			delete ItemId;
			alert('Item Stored!');
			window.location.reload();
			window.location.href="../index.html";
		} catch (e) {
			if (e === QUOTA_EXCEEDED_ERR) {
				alert('The storage in your device is full.');
			}
		}
	}
}

function clearItem() {
	document.getElementById('nameInput').value = "";
	$('#mapImage').empty();
	$('#clearSaveButtons').fadeOut('slow');
	$('#geoButton').fadeIn('slow');
}