RemoteStorage.version = RemoteStorage.prototype.version = {
  productName: 'remotestorage.js',
  product: 0,
  major: 8,
  minor: 0,
  postfix: 'dev'
};

RemoteStorage.version.toString = function() {
  return this.productName + ' '
    + [this.product, this.major, this.minor].join('.')
    + (this.postfix ? '-' + this.postfix : '');
};
