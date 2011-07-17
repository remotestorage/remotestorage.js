//taken from html web storage interface:
//length
//keys
//getItem -> will only work for synced items. there is no way to access items that you didn't sync first.
//setItem -> will automatically add item to synced items and overwrite remote value, if any
//removeItem -> will keep item synced, but with negative caching entry indicating the fact that this key is not present in remote
//not offering clear() in case people confuse it with flush. to clear, loop through keys() and do removeItem() one-by-one

//adding:
//syncItems(keys) -> adds items to synced items. will trigger one storage event per item when value becomes available. after that, getItem will work on them
//flushItems(keys) -> per-item flush gives more control over the caching/garbage collection strategy, but stay connected. 
//pushTo(storageParams) -> will change the remote storage, then push out local cache contents (all synced items). pushTo(null) will disconnect but keep a local copy. not sure when you would want to disconnect but leave local copy of the data, unless the local copy were encrypted (which currently it's not)
//pullFrom(storageParams) -> will flushAll(), then change the remote storage. pullFrom(null) will disconnect and flush all cache. this is the way to log out and leave a shared computer.



//not logged in -> local-only copy. effect is the same as localStorage, except flush is a synonym for clear, and no events from other windows come in.
//logging in -> whatever is the current local copy is flushed (so if it was a local-only copy, it's cleared as well. sorry. :)
//at first nothing happens, but the app can do a prefetch of a list of keys to force loading some stuff in and getting some storage events triggered as data arrives
//automatically set lock, overwritting any lock that may be there. in the future we might make this more usable and less aggressive.
//if get a key that's not cached, it will return false, but still trigger a prefetch. negative caching is done with a special value.
//flush will set all keys to not cached (false), and only in the cache. clear will set all keys to null (remove them), with write-through.
//if set a key, whether cached or not, it's write-through
//if logged in but offline, changes are queued and will be pushed (write-through) when you come back online

function SyncStorage() {
	var remoteStorage = null;
	var keys = {};
	function cacheGet(key) {
		if(keys[key]) {
			return localStorage.getItem("_syncStorage_"+key);
		} else {
			return false;
		}
	}
	function cacheSet(key, value) {
		localStorage.setItem("_syncStorage_"+key, value);
	}
	function triggerStorageEvent(key, oldValue, newValue) {
		var e = document.createEvent("StorageEvent");
		e.initStorageEvent('storage', false, false, key, oldValue, newValue, window.location.href, window.syncStorage);
		dispatchEvent(e);
	}
	var prefetch = function(keysArg) {
		var i;
		for(i=0;i<keysArg.length;i++) {
			var key = keysArg[i];
			keys[key] = true;
			var cachedVal = cacheGet(key);
			if(cachedVal === false) {
				remoteStorage.get(key, function(result) {
					if(result.success) {
						cacheSet(key, result.value);
						triggerStorageEvent(key, false, result.value);
					} else {
						//report sync error
					}
				});
			} else {
				triggerStorageEvent(key, false, cachedVal);
			}
		}
	};
	var writeThrough = function(key, oldValue, newValue) {
		remoteStorage.set(key, newValue, function(result) {
			if(result.success) {
				//...
			} else {
				cacheSet(key, oldValue);
				triggerStorageEvent(key, newValue, oldValue);
			}
		});
	};
	var syncStorage = {
		error: null,
		length: keys.length,
		key: function(i) {
			return "return keys[i]";//need to find array_keys() function in js
		},
		getItem: function(key) {
			localVal = cacheGet(key);
			if(localVal == null) {//cache miss
				syncKey(key, null);
			}
			return localVal;
		},
		setItem: function(key, val) {
			keys[key] = true;
			localVal = localStorage.getItem("_syncStorage_"+key);
			if(localVal == val) {
				return;
			} else {
				cacheSet(key, val);
				writeThrough(key, localVal, val);
			}
		},
		removeItem: function(key) {
			window.localStorage.removeItem(key);
			syncStorage.length = window.localStorage.length;
			syncStorage.remoteStorage.syncKey(key);
		},
		flush: function() {
			window.localStorage.clear();
		},
		pullFrom: function(params) {
			if(params.storageType == "http://unhosted.org/spec/dav/0.1") {
				remoteStorage = UnhostedDav_0_1(params);
			} else {
				syncStorage.error = "unsupported remote storage type "+remoteStorageType;
			}
		},
		syncKeys: function(keys) {
			prefetch(keys);
		}
	};
	return syncStorage;
}
window.syncStorage = SyncStorage();
