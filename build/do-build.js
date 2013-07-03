
var fs = require('fs');
var builder = require('./builder');

var components = JSON.parse(fs.readFileSync('build/components.json'));

fs.writeFileSync('remotestorage.js', builder.build(components, process.argv.slice(2)));
