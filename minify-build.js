var minify = require('minify');
var fs = require('fs');

minify('remotestorage.js', {
  returnName : true,
  log : true
}, function (error, fileData) {
  if (error) {
    throw new Error(error);
  }
  fs.writeFileSync('remotestorage.min.js', fileData, { encoding: 'utf8' });
});
