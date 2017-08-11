var RemoteStorage = require('./remotestorage');
RemoteStorage.version = RemoteStorage.prototype.version = {
  productName: 'remotestorage.js',
  product: 1,
  major: 0,
  minor: 0,
  postfix: 'alpha6'
};

RemoteStorage.version.toString = function () {
  return this.productName + ' '
    + [this.product, this.major, this.minor].join('.')
    + (this.postfix ? '-' + this.postfix : '');
};
