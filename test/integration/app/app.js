define(['remotestorage/remoteStorage-modules'], function(remoteStorage) {

  // make remoteStorage global, so injected scripts can access it.
  window.remoteStorage = remoteStorage;

  // (window.clearStateChanges = function() {
  //   window.stateChanges = [];
  // })();

  window.onload = function() {

    remoteStorage.disableSyncThrottling();

    window.notify = function(message, close) {
      window.noticeDone = false;
      var h = document.createElement('h1');
      h.innerHTML = message;
      document.body.insertBefore(h, document.body.firstChild);

      if(close) {
        setTimeout(function() {
          document.body.removeChild(h);
          window.noticeDone = true;
        }, 2000);
      }
    }

    var logDiv = document.getElementById('log');

    remoteStorage.util.setLogFunction(function(name, level, args) {
      var messageDiv = document.createElement('div');
      var levelDiv = document.createElement('div');
      levelDiv.setAttribute('style', "font-weight:bold;");
      levelDiv.innerHTML = name.toUpperCase() + ' ' + level;
      messageDiv.appendChild(levelDiv);
      var argDiv = document.createElement('div');
      argDiv.style['font-family'] = 'monospace';
      argDiv.innerHTML = args.map(function(arg) {
        return typeof(arg) == 'object' ? JSON.stringify(arg) : arg;
      }).join('\n');
      messageDiv.appendChild(argDiv);
      logDiv.appendChild(messageDiv);
    });

    remoteStorage.claimAccess('root', 'rw');

    remoteStorage.root.use('/');

    // remoteStorage.onWidget('state', function(state) {
    //   stateChanges.push(state);
    // });

    remoteStorage.displayWidget('remotestorage-connect');

  }

});
