define(['./util'], function(util) {

  var translations = {
    en: {
      widget: {
        // Bubble text in initial state
        'connect-remotestorage': 'Connect <strong>remotestorage</strong>',
        // Connect button label
        'connect': 'connect',
        'sync': 'sync',
        'disconnect': 'disconnect',
        'permissions': 'Permissions',
        'all-data': 'All data',
        'synchronizing': 'Synchronizing <strong>{userAddress}</strong>',
        'connecting': 'Connecting <strong>{userAddress}</strong>...',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Unauthorized! Click to reconnect.'
      }
    },
    de: {
      widget: {
        'connect-remotestorage': 'Verbinde <strong>remotestorage</strong>',
        'connect': 'Verbinden',
        'sync': 'Sync',
        'disconnect': 'Verbindung trennen',
        'permissions': "Zugriffsrechte",
        'all-data': "Alle Daten",
        'synchronizing': 'Synchronisiere <strong>{userAddress}</strong>',
        'connecting': 'Verbinde <strong>{userAddress}</strong>...',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Zugriff fehlgeschlagen. Klicke um neu zu verbinden.'
      }
    }
  };

  var currentTable = translations.en;

  var NotFound = function(keyPath) {
    this.message = "Translation not found: " + keyPath.join(', ');
  };

  return {
    setLocale: function(locale) {
      currentTable = translations[locale];
    },

    t: function() {
      try {
        var keys = util.toArray(arguments);
        var last = keys.slice(-1)[0];
        var replacements;
        if(typeof(last) === 'object') {
          replacements = last;
          keys = keys.slice(0, -1);
        }
        var result = currentTable;
        keys.forEach(function(key, index) {
          result = result[key];
          if(! result) {
            throw new NotFound(keys.slice(0, index));
          }
        });
        if(replacements) {
          for(var k in replacements) {
            var re = new RegExp('\\{' + k + '\\}');
            result = result.replace(re, replacements[k]);
          }
        }
        return result;
      } catch(exception) {
        if(exception instanceof NotFound) {
          return exception.message;
        } else {
          throw exception;
        }
      }
    }
  };
});
