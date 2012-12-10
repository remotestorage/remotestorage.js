
define([
  '../util',
  './common',
  './pending'
], function(util, common, pendingAdapter) {

  var logger = util.getLogger('store::websql');

  var DB_NAME = 'remotestorage';
  var DB_VERSION = '1.0';
  var DB_HINT = 'remoteStorage.js local cache';
  // FIXME: resize as needed?
  var DB_SIZE = 50*1024*1024;

  var adapter = function() {

    var DB;

    if(typeof(window) === 'undefined' ||
       typeof(window.openDatabase) !== 'function') {
      throw new Error("Not supported: window.openDatabase not found");
    }

    function openDatabase() {
      logger.info('Opening database...');
      DB = window.openDatabase(DB_NAME, DB_VERSION, DB_HINT, DB_SIZE);
      logger.info("DB is ", DB);
      return executeWrite("CREATE TABLE IF NOT EXISTS nodes (key, meta, data)").
        then(function() {
          logger.info("Database opened.", DB);
          if(tempAdapter.replaceWith) {
            logger.info("FLUSHING!");
            tempAdapter.replaceWith(webSqlStore);
          }
        }, function() {
          logger.error("OPEN DB FAILED", arguments);
        });
    }

    function executeSql(rw, query) {
      var vars = Array.prototype.slice.call(arguments, 2);
      return util.makePromise(function(promise) {
        DB[rw ? 'transaction' : 'readTransaction'](function(transaction) {
          transaction.executeSql(
            query, vars, util.bind(promise.fulfill, promise),
            util.bind(promise.fail, promise)
          );
        });
      });
    }

    var executeRead = util.curry(executeSql, false);
    var executeWrite = util.curry(executeSql, true);

    var tempAdapter = pendingAdapter();

    var webSqlStore = {
      on: function(eventName, handler) {
        logger.debug("WARNING: webSQL event handling not implemented");
      },
      _get: function(key) {
        return executeRead('SELECT * FROM nodes WHERE key = ? LIMIT 1', key).
          then(function(transaction, result) {
            if(result.rows.length > 0) {
              var row = result.rows.item(0);
              if(row.meta && row.meta[0] === '{') {
                var node = JSON.parse(row.meta);
                node.data = row.data;
                return common.unpackData(node);
              }
            }
          });
      },
      get: function(key) {
        logger.debug('GET', key);
        return webSqlStore._get(key);
      },
      set: function(key, value) {
        logger.debug('SET', key);
        var node = common.packData(value);
        var data = node.data;
        delete node.data;
        return webSqlStore._get(key).
          then(function(result) {
            return executeWrite(
              ( result ?
                'UPDATE nodes SET meta = ?, data = ? WHERE key = ?' :
                'INSERT INTO nodes (meta, data, key) VALUES (?, ?, ?)' ),
              JSON.stringify(node), data, key
            );
          });
      },
      remove: function(key) {
        logger.debug('REMOVE', key);
        return executeWrite('DELETE FROM nodes WHERE key = ?', key);
      },
      forgetAll: function() {
        logger.debug('FORGET ALL');
        return executeWrite('DELETE FROM nodes');
      }
    };

    openDatabase().onerror = function(error) {
      logger.error("Database error: ", error);
    };

    return tempAdapter;
  };

  return adapter;
});
