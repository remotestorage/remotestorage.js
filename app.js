var RemoteStorage = require('./node-main');
RemoteStorage._log = true;

var remoteStorage = new RemoteStorage();
global.remoteStorage = remoteStorage;

remoteStorage.enableLog();

require('./remotestorage-bookmarks');

var userAddress = 'galfert@5apps.com';
var storageURL = 'https://storage.5apps.com/galfert';
var storageAPI = 'draft-dejong-remotestorage-01';
var token = 'a4fb9944b400de3e056fa408e1a1efa2';

remoteStorage.remote.configure(userAddress, storageURL, storageAPI, token);

remoteStorage.access.claim('bookmarks', 'rw');
console.log('access claimed');

remoteStorage.caching.enable('/bookmarks/archive/');
console.log('caching enabled');

var client = remoteStorage.bookmarks.client.scope('archive/');

client.on('change', function(event){
  console.log('change event', event);
});

remoteStorage.bookmarks.archive.getAll().then(
  function(bookmarks) {
    console.log('bookmarks', bookmarks);
  },
  function(error) {
    console.log('error fetching all bookmarks', error);
  }
);

// Using this just to keep the script running
var http = require('http');
http.createServer(function(req, res) {}).listen(7777);
