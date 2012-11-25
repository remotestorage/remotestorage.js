
var DEBUG = false;

var fs = require('fs');
var uglify = require('uglify-js');

function debug() {
  if(DEBUG) {
    console.log.apply(console, arguments);
  }
}

global.debug = debug;

function catchErr(block, hint) {
  return function(err) {
    if(err) {
      throw new Error(hint + ': ' + err);
    }
    return block.apply(this, Array.prototype.slice.call(arguments, 1));
  };
}

global.catchErr = catchErr;

var tempIndex = 0;

function makeTempName() {
  return "/tmp/rs-builder-" + process.pid + "-" + (tempIndex++) + ".tmp";
}

global.makeTempName = makeTempName

var filterFunctions = {
  'requirejs': require('./filters/requirejs'),
  'strip-debug': require('./filters/stripDebug'),
  'minify': require('./filters/minify')
};

var combineFunctions = {
  'concat': function(inputs, callback) {
    callback(inputs.map(function(input) {
      return input.data;
    }).join('\n'));
  }
}; 

var builder = {

  run: function(inputFiles, options, callback) {
    if(options.debug) {
      DEBUG = true;
    }

    debug('run', inputFiles, options);

    builder.readInputFiles(inputFiles, function(inputs) {

      builder.runFilters(options.filter, inputs, function() {
        if(! options.combine) {
          options.combine = 'concat';
        }

        debug('combine: ' + options.combine);
        var combineFunction = combineFunctions[options.combine];

        if(! combineFunction) {
          throw "Unknown combine function: " + options.combine;
        }

        combineFunction(inputs, function(output) {

          var globalObjectName = options.target === 'node' ? 'global' : 'window';

          if(options.globalExport) {
            options.globalExport.forEach(function(globalName) {
              output += ('\n' + globalObjectName + '.' + globalName +
                         '=require("' + globalName + '");');
            });
          }

          if(options.output) {
            fs.writeFile(options.output, output, function(err) {
              if(err) {
                throw "Failed to write " + options.output + ": " + err;
              } else {
                callback();
              }
            });
          } else {
            console.log(output);
            callback();
          }

        });
      });

    });
  },

  readInputFiles: function(inputFiles, callback) {
    debug('readInputFiles');
    var inputs = [];
    var read = 0;
    inputFiles.forEach(function(fileName, index) {
      fs.readFile(fileName, 'UTF-8', function(err, data) {
        if(err) {
          throw "Failed to read " + fileName + ": " + err;
        } else {
          read++;
          inputs[index] = { fileName: fileName, data: data };
        }

        if(read === inputFiles.length) {
          callback(inputs);
        }
      });
    });
  },

  runFilters: function(filterNames, inputs, callback) {
    debug('runFilters', filterNames);
    if(filterNames) {
      var filters = filterNames.map(function(filterName) {
        if(filterName in filterFunctions) {
          return filterFunctions[filterName];
        } else {
          throw "Unknown filter: " + filterName;
        }
      });

      var inputsDone = 0;

      inputs.forEach(function(input, index) {
        var filterIndex = 0;

        function runOne() {
          debug('runFilters~runOne', filterIndex, inputsDone);
          var filter = filters[filterIndex++];
          filter(inputs[index], function(output) {
            debug('runFilters~runOne: one done', index);
            if(typeof(output) === 'string') {
              var tempName = makeTempName();
              fs.writeFileSync(tempName, output, 'UTF-8');
              inputs[index] = { fileName: tempName, data: output };
            } else {
              inputs[index] = output;
            }
            if(filterIndex === filters.length) {
              inputsDone++;

              if(inputsDone === inputs.length) {
                debug('runFilters~runOne: all done.');
                callback();
              }
            } else {
              runOne();
            }
          });
        }

        runOne();

      });

    } else {
      console.log("WARNING: no filters specified");

      callback();
    }
  },

  // COMMAND LINE

  main: function(argv) {

    if(argv.length === 0) {
      return builder.usage();
    }

    var options = {};
    var inputFiles = [];
    builder.parseOptions(argv, inputFiles, options);

    if(options.help) {
      return builder.usage();
    }

    if(inputFiles.length === 0) {
      throw "No input files.";
    }

    builder.run(inputFiles, options, function() {
      debug('main() done');
    });
  },

  usage: function() {
    var usage = [
      '',
      'Usage: ' + process.argv.slice(0, 2).join(' ') + ' [options] <input> [<input> ...]',
      '',
      'Options:',
      '  -h                 Display this text',
      '  -d                 Enable debug output',
      '  -f <filterName>    Filter to run for each file (use this option multiple times)',
      '  -c <combineName>   Combine function to use to join all inputs to a final result',
      '  -o <outputFile>    Specify file to write output to',
      '  -g <globalName>    Export global symbol (must resolve to an AMD module)',
      '  -t <target>        Target platform. "node" or "browser"',
      '',
      'Available filters:'
    ];
    for(var filterName in filterFunctions) {
      usage.push('  * ' + filterName);
    }
    usage.push('');
    usage.push('Available combine functions:');
    for(var combineName in combineFunctions) {
      usage.push('  * ' + combineName);
    }
    usage.push('');
    console.log(usage.join('\n'));
  },

  parseOptions: function(argv, inputFiles, options) {
    debug('parseOptions');
    var optionsRE = /^\-([a-z])$/;
    var flagOptions = { 'd': 'debug', 'h': 'help' };
    var singleArgOptions = { 'o': 'output', 'c': 'combine', 't': 'target' };
    var multiArgOptions = { 'f': 'filter', 'g': 'globalExport' };

    var lastOpt;
    var lastOptMultiple;

    argv.forEach(function(arg) {
      var md;
      if(lastOpt) {
        if(lastOptMultiple) {
          if(options[lastOpt] instanceof Array) {
            options[lastOpt].push(arg);
          } else {
            options[lastOpt] = [arg];
          }
        } else {
          options[lastOpt] = arg;
        }
        lastOpt = undefined;
        lastOptMultiple = undefined;
      } else if((md = arg.match(optionsRE))) {
        if(md[1] in singleArgOptions) {
          lastOpt = singleArgOptions[ md[1] ];
        } else if((md[1] in multiArgOptions)) {
          lastOpt = multiArgOptions[ md[1] ];
          lastOptMultiple = true;
        } else if(md[1] in flagOptions) {
          var optName = flagOptions[ md[1] ];
          options[optName] = true;
        } else {
          throw "Unknown option: " + md[1];
        }
      } else {
        inputFiles.push(arg);
      }
    });

    if(lastOpt) {
      throw "Missing option argument";
    }

  }

};

if(module.parent) {
  module.exports = builder;
} else {
  try {
    builder.main(process.argv.slice(2), function() {
      debug("Builder done.");
    });
  } catch(exc) {
    if(typeof(exc) === 'string') {
      console.log("Error: " + exc);
    } else {
      console.log("Error: " + exc.message);
      console.log(exc.stack);
    }
  };
}
