define('remoteStorage-modules', [
  'remoteStorage',
  './modules/root',
  './modules/calendar',
  './modules/contacts',
  './modules/documents',
  './modules/money',
  './modules/tasks',
  './modules/bookmarks',
  './modules/messages'
], function(remoteStorage) {
  return remoteStorage;
});

