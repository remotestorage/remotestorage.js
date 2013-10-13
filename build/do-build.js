
var fs = require('fs');
var builder = require('./builder');

var argv = process.argv.slice(2);
var output = argv.shift();
var options = {};
if(argv[0] == '--amd') {
  options.amd = true;
  argv = argv.slice(1);
} else if(argv[0] == '--node') {
  options.node = true;
  argv = argv.slice(1);
}

var components = JSON.parse(fs.readFileSync('build/components.json'));

fs.writeFileSync(output, builder.build(components, argv, options));
