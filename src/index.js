
/*!
* remoteStorage-node
* Copyleft(c) 2012 The Unhosted project community <hi@unhosted.org>
* AGPL or MIT Licensed
*/

var require = require('requirejs');
require(['./remoteStorage'], function(remoteStorage) {
  exports.remoteStorage = remoteStorage;
});
