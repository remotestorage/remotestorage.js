function UnhostedDav_0_1(davUrl, userName, userHost, dataScope, password) {
	var davStorage = {
		davUrl: davUrlArg,
		userHost: userHostArg,
		userDomain: userDomainArg,
		dataScope: dataScopeArg,
		password: passwordArg,
		syncKey: function(key, oldValue) {
			var localVal = localStorage.getItem(key);
			if(localVal == null) {//cache miss, syncKey means get.
				davGet(key, function(result) {	
					if(result.success) {
						localStorage.setItem(key, result.value);
						$(window).trigger(jQuery.Event('storage', {
							originalEvent: {
								key: key,	
								oldValue: null,
								newValue: result.value,
								url: document.location.href,//not sure if this is correct?
								storageArea: window.syncStorage
							}
						}));
					}
				});
			} else {
				davSet(key, localStorage.getItem(key), function(result) {
				});
			}
		}
	}
	return davStorage;
}
function SyncStorage() {
	var remoteStorage = null;
	var syncStorage = {
		error: null,
		length: window.localStorage.length,
		key: function(i) {
			return window.localStorage.key(i);
		},
		getItem: function(key) {
			localVal = window.localStorage.getItem(key);
			if(localVal == null) {//cache miss
				syncKey(key, null);
			}
			return localVal;
		},
		setItem: function(key, val) {
			return window.localStorage.setItem(key, val);
			syncStorage.length = window.localStorage.length;
			syncStorage.remoteStorage.syncKey(key);
		},
		removeItem: function(key) {
			window.localStorage.removeItem(key);
			syncStorage.length = window.localStorage.length;
			syncStorage.remoteStorage.syncKey(key);
		},
		flush: window.localStorage.clear,
		clear: function() {},
		connect: function(remoteStorageType, params) {
			if(remoteStorageType == "http://unhosted.org/spec/dav/0.1") {
				syncStorage.remoteStorage = UnhostedDav_0_1(params.url, params.userName, params.userHost, params.dataScope, params.password);
			} else {
				syncStorage.error = "unsupported remote storage type "+remoteStorageType;
			}
		}
	};
	var syncKey = function(key) {
		if(remoteStorage) {
			remoteStorage.syncKey(key);
		}
	};
	var _storageEvent = function(e) {//if this window is synced, and another window updates localStorage, then send to remote, or change it back:
		if(e.originalEvent.storageArea == window.localStorage) {
			syncKey(e.originalEvent.key);
			$(window).trigger(jQuery.Event('storage', {
				originalEvent: {
					key: e.originalEvent.key,
					oldValue: e.originalEvent.oldValue,
					newValue: e.originalEvent.newValue,
					url: e.originalEvent.url,
					storageArea: window.syncStorage
					}
				}));
		}
	}
	addEventListener('storage', _storageEvent, false);
	return syncStorage;
}
window.syncStorage = SyncStorage();
