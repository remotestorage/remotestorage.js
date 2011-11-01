// INTERFACE:
//
// 1) interface for data is the same as localStorage and sessionStorage, namely:
//
// window.remoteStorage.length
// window.remoteStorage.key(i)
// window.remoteStorage.getItem(key)
// window.remoteStorage.setItem(key, value);
// window.remoteStorage.removeItem(key);
// window.remoteStorage.clear();
//
// Note: we don't support syntactic sugar like localStorage.key or localStorage['key'] - please stick to getItem()/setItem()
//
//
// 2) additional interface to connect/check/disconnect backend:
//
// window.remoteStorage.connect('user@host', 'sandwiches');
// window.remoteStorage.isConnected();//boolean
// window.remoteStorage.getUserAddress();//'user@host'
// window.remoteStorage.disconnect();


(function() {
  if(!window.remoteStorage) {//shim switch
