var RemoteStorage = require('./node-main');
var remoteStorage = new RemoteStorage({
  logging: false
});
global.remoteStorage = remoteStorage;

remoteStorage.on('ready', function () {
  console.log('ready!');

  remoteStorage.bookmarks.archive.store({
    url: 'testurl',
    title: 'this about Me'
  }).then(function (bm) {
    console.log('-- stored a bookmark: ', bm);
    remoteStorage.bookmarks.archive.getAll().then(
      function (bookmarks) {
        console.log('-- all bookmarks', bookmarks);
      },
      function (error) {
        console.log('error fetching all bookmarks', error);
      }
    );
  });

});

require('./remotestorage-bookmarks');

remoteStorage.access.claim('bookmarks', 'rw');
console.log('access claimed');

remoteStorage.caching.enable('/bookmarks/archive/');
console.log('caching enabled');

var client = remoteStorage.bookmarks.client.scope('archive/');

client.on('change', function(event){
    console.log('change event', event);
});

// var userAddress = 'galfert@5apps.com';
// var storageURL = 'https://storage.5apps.com/galfert';
// var storageAPI = 'draft-dejong-remotestorage-01';
// var token = 'a4fb9944b400de3e056fa408e1a1efa2';
