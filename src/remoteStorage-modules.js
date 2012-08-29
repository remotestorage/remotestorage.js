define('remoteStorage-modules', [
  'remoteStorage',
  './modules/root',
  './modules/calendar',
  './modules/contacts',
  './modules/documents',
  './modules/money',
  './modules/tasks'
], function(remoteStorage) {
  return remoteStorage;
});

