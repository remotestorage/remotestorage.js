define(['./util', './sync'], function(util, sync) {

  var logger = util.getLogger('schedule');

  var watchedPaths = {};
  var lastPathSync = {};
  var runInterval = 5000;
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
    for(var p in watchedPaths) {
      var lastSync = lastPathSync[p];
      if((! lastSync) || (lastSync + watchedPaths[p]) <= now) {
        syncNow.push(p);
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
      var syncer = path === '/' ? sync.fullSync : util.curry(sync.partialSync, path);
      syncer().then(function() {
        lastPathSync[path] = new Date().getTime();

        syncedCount++;

        logger.debug('now synced', syncedCount, 'of', numSyncNow);

        if(syncedCount == numSyncNow) {
          scheduleNextRun();
        }
      });
    }
  }

  return {

    get: function(path) {
      if(path) {
        return watchedPaths[path];
      } else {
        return watchedPaths;
      }
    },

    enable: function() {
      enabled = true;
      logger.info('enabled');
      scheduleNextRun();
    },

    disable: function() {
      enabled = false;
      logger.info('disabled');
    },

    isEnabled: function() {
      return enabled;
    },

    watch: function(path, interval) {
      logger.info("Schedule sync of", path, "every", interval / 1000.0, "seconds");
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
    },

    reset: function() {
      watchedPaths = {};
      lastPathSync = {};
      if(timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

  };

});
