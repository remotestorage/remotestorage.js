'use strict';

module.exports = {
  diff: true,
  extension: ['ts'],
  reporter: 'spec',
  require: 'ts-node/register',
  'watch-files': ['src/**/*.ts', 'test/unit/*.ts']
};
