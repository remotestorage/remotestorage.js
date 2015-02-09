RemoteStorage.version = RemoteStorage.prototype.version = {
  productName: 'remotestorage.js',
  product: 0,
  major: 11,
  minor: 2,
  postfix: 'pre'
};

RemoteStorage.version.toString = function () {
  return this.productName + ' '
    + [this.product, this.major, this.minor].join('.')
    + (this.postfix ? '-' + this.postfix : '');
};
