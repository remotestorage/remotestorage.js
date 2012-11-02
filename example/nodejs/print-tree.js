
var remoteStorage = require('../../build/latest/remoteStorage-node-modules-debug');

remoteStorage.util.silenceAllLoggers();

function login(callback) {
  var args = process.argv.slice(2);

  process.stdin.resume();
  process.stdin.setEncoding('UTF-8');

  var bearerToken, userAddress;

  function haveUserAddress(userAddress) {
    remoteStorage.nodeConnect.setUserAddress(userAddress, function(err) {
      if(err) {
        callback(["Failed to discover storage info for " + userAddress, err]);
      } else {
        if(bearerToken) {
          remoteStorage.nodeConnect.setBearerToken(bearerToken);
          callback();
        } else {
          process.stdout.write("Bearer token: ");
          process.stdin.once('data', function(bearerToken) {
            remoteStorage.nodeConnect.setBearerToken(bearerToken);
            callback();
          });
        }
      }
    });
  }

  userAddress = args[0];
  bearerToken = args[1];

  if(userAddress) {
    haveUserAddress(userAddress);
  } else {
    process.stdout.write("User address (user@host): ");
    process.stdin.once('data', function(userAddress) {
      userAddress = userAddress.trim();
      haveUserAddress(userAddress);
    });
  }
}

function printTree(root, indent) {
  if(! indent) {
    indent = '';
  }
  var listing = remoteStorage.root.getListing(root);
  if(listing.length == 0) {
    console.log(indent + ' (empty)');
  } else {
    listing.forEach(function(item) {
      var path = root + item;
      if(remoteStorage.util.isDir(item)) {
        console.log(indent + '+ ' + item);
        printTree(path, '  ' + indent);
      } else {
        console.log(indent + '- ' + item);
      }
    });
  }
}

login(function(err) {
  if(err) {
    console.error('error', err);
      process.exit();
  } else {
    remoteStorage.claimAccess('root', 'rw');
    remoteStorage.root.use('/');
    remoteStorage.fullSync(function() {
      console.log('+ /');
      printTree('/', '|-');
      process.exit();
    });
  }
});
