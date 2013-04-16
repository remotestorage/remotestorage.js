var o = JSON.parse(require('fs').readFileSync(process.argv[2], 'UTF-8'));
o.version = process.argv[3];
console.log(JSON.stringify(o, undefined, 2));