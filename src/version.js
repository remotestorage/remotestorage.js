RemoteStorage.version = RemoteStorage.prototype.version = {
  productName: 'remotestorage.js',
  product: 0,
  major: 10,
  minor: 0,
  postfix: 'beta3'
};

RemoteStorage.version.toString = function() {
  return this.productName + ' '
    + [this.product, this.major, this.minor].join('.')
    + (this.postfix ? '-' + this.postfix : '');
};
