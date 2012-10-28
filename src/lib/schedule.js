define(['./util', './sync'], function(util, sync) {

  var logger = util.getLogger('schedule');

  var watchedPaths = {};
  var lastPathSync = {};
  var runInterval = 30000;
  var enabled = false;
  var timer = null;

  function scheduleNextRun() {
    timer = setTimeout(run, runInterval);
  }

  function run() {
    if(! enabled) {
      return;
    }
    if(timer) {
      clearTimeout(timer);
    }

    logger.info('check');

    var syncNow = [];
    var syncedCount = 0;

    var now = new Date().getTime();

    // assemble list of paths that need action
    for(var path in watchedPaths) {
      var lastSync = lastPathSync[path];
      if((! lastSync) || (lastSync + watchedPaths[path]) <= now) {
        syncNow.push(path);
      }
    }

    if(syncNow.length === 0) {
      scheduleNextRun();
      return;
    }

    logger.info("Paths to refresh: ", syncNow);

    // request a sync for each path
    var numSyncNow = syncNow.length;
    for(var i=0;i<numSyncNow;i++) {
      var path = syncNow[i];
      var syncer = function(path, cb) {
        if(path == '/') {
          sync.fullSync(cb);
        } else {
          sync.partialSync(path, null, cb);
        }
      };
      syncer(path, function() {
        lastPathSync[path] = new Date().getTime();

        syncedCount++;

        if(syncedCount == syncNow.length) {
          scheduleNextRun();
        }
      });
    }
  }

  return {

    enable: function() {
      enabled = true;
      logger.info('enabled');
      scheduleNextRun();
    },

    disable: function() {
      enabled = false;
      logger.info('disabled');
    },

    watch: function(path, interval) {
      watchedPaths[path] = interval;
      if(! lastPathSync[path]) {
        // mark path as synced now, so it won't get synced on the next scheduler
        // cycle, but instead when it's interval has passed.
        lastPathSync[path] = new Date().getTime();
      }
    },

    unwatch: function(path) {
      delete watchedPaths[path];
      delete lastPathSync[path];
    }

  };

});