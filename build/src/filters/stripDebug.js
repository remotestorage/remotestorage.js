
var debugStatementRE = /logger.debug\(/;

module.exports = function(input, callback) {
  var outputLines = [];
  input.data.split('\n').forEach(function(line) {
    if(! debugStatementRE.test(line)) {
      outputLines.push(line);
    }
  });
  callback(outputLines.join('\n'));
};
