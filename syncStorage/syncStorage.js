//
// syncStorage.onStatus = function('offline'/'readonly'/'sending'/'receiving'/'ready')
// syncStorage.onUserAddress = function('user@host')
// syncStorage.onItem = function('key', 'val')
// syncStorage.setUserAddress('user@host','token'/'user@host'/null/)
// syncStorage.fetchItem('key')
// syncStorage.setItem('key', 'val')
// syncStorage.removeItem('key')

function SyncStorage() {
	var syncStorage = {
		onStatus: (function(){}),
		onUserAddress: (function(){}),
		onItem: (function(){}),
	};
	var pending = {};

	var KeyToLocalKey = function(keyStr) {
		return "syncStorage_"+syncStorage.userAddress+"_"+keyStr;
	}
	var KeyToRemoteKey = function(keyStr) {
		return "https://dav01.federoni.org/webdav/dev.unhosted.org/mich/"+syncStorage.dataScope+"/"+keyStr;
	}
	var fetch = function(keyStr) {
		if(pending[keyStr]=='push') {
			return;
		}
		pending[keyStr] = 'fetch';
		xhr = new XMLHttpRequest();
		xhr.open("GET", KeyToRemoteKey(keyStr), true);
		syncStorage.onStatus('sending');
		xhr.onreadystatechange = function() {
			if(xhr.readyState == 4) {
				if(xhr.status == 200) {
					if(pending[keyStr]=='fetch') {
						localStorage.setItem(KeyToLocalKey(keyStr), xhr.responseText);
						delete pending[keyStr];
						syncStorage.onStatus('ok');
						syncStorage.onItem(keyStr, xhr.responseText);
					}
				} else {
					syncStorage.onStatus("offline");
				}
			}
		}
		xhr.send();
	}
	var push = function(keyStr, valStr) {
		pending[keyStr] = 'fetch';
		xhr = new XMLHttpRequest();
		xhr.open("PUT", KeyToRemoteKey(keyStr), true);
		syncStorage.onStatus("sending");
		xhr.onreadystatechange = function() {
			if(xhr.readyState == 4) {
				if(xhr.status == 200) {
					syncStorage.onStatus("ok");
				} else {
					syncStorage.onStatus("offline");
				}
			}
		}
		xhr.send();
	}
	syncStorage.setUserAddress = function(userAddress, authToken) {
		if(userAddress == undefined) {
			//will need login screen
		}
		if(authToken == undefined) {
			//will need oauth dance
		}
		syncStorage.onUserAddress(userAddress);
		syncStorage.onStatus('ok');
	}
	syncStorage.setItem = function(keyStr, valStr) {
		localStorage.setItem(KeyToLocalKey(keyStr), valStr);
		push(keyStr, valStr);
		syncStorage.onItem(keyStr, valStr);
	}
	syncStorage.fetchItem = function(keyStr, forceFetch) {
		if(forceFetch) {
			fetch(keyStr);
		} else {
			var localVal = localStorage.getItem(KeyToLocalKey(keyStr));
			if(localVal == null) {//cache miss
				fetch(keyStr);
			} else {
				syncStorage.onItem(keyStr, localVal);
			}
		}
	}
	syncStorage.removeItem = function(keyStr) {
		localStorage.removeItem(KeyToLocalKey(keyStr));
		push(keyStr, null);
		syncStorage.onItem(keyStr, null);
	}
	return syncStorage;
}
