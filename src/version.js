RemoteStorage.version = RemoteStorage.prototype.version = {
  productName: 'remotestorage.js',
  product: 0,
  major: 12,
  minor: 1,
  postfix: null
};

RemoteStorage.version.toString = function () {
  return this.productName + ' '
    + [this.product, this.major, this.minor].join('.')
    + (this.postfix ? '-' + this.postfix : '');
};
