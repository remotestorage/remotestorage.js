window.syncStorage = {
	length: window.localStorage.length,
	key: function(i) {
		return window.localStorage.key(i);
	},
	getItem: function(key) {
		return window.localStorage.getItem(key);
	},
	setItem: function(key, val) {
		return window.localStorage.setItem(key, val);
		window.syncStorage.length = window.localStorage.length;
	},
	removeItem: function(key) {
		window.localStorage.removeItem(key);
		window.syncStorage.length = window.localStorage.length;
	},
	flush: window.localStorage.clear,
	clear: function() {},
	syncKey: function(key) {}
};
$(window).bind('storage', function(e) {//if this window is synced, and another window updates localStorage, then send to remote, or change it back:
	if(e.originalEvent.storageArea == window.localStorage) {
		window.syncStorage.syncKey(e.originalEvent.key);
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
});
