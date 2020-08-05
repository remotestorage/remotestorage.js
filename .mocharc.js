'use strict';

module.exports = {
  diff: true,
  extension: ['ts'],
  reporter: 'dot',
  require: 'ts-node/register',
  'watch-files': ['src/**/*.ts', 'test/unit/*.ts']
};
