
var uglify = require('uglify-js');

module.exports = function(input, callback) {
  var ast = uglify.parse(input.data);
  ast.figure_out_scope();
  ast = ast.transform(uglify.Compressor());
  ast.figure_out_scope();
  ast.compute_char_frequency();
  ast.mangle_names();
  callback(ast.print_to_string());
};