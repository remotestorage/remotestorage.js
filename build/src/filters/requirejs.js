
/** requirejs filter

    Used to combine all 

 */

var fs = require('fs');
var path = require('path');
var requirejs = require('requirejs');

var SOURCE_ROOT = path.join(__dirname, '..', '..', '..', 'src');

module.exports = function(input, callback) {

  debug('requirejs filter');

  var tempOutput = makeTempName();
  var inputName = input.fileName.replace('../src/', '').replace(/\.js$/, '');

  requirejs.optimize({
    baseUrl: '../src',
    name: '../build/lib/almond',
    optimize: 'none',
    include: [inputName],
    out: tempOutput
  }, function() {
    fs.readFile(tempOutput, 'UTF-8', catchErr(function(output) {
      callback({ fileName: tempOutput, data: output });
    }, 'readFile'));
  });

};
