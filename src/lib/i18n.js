define(['./util'], function(util) {

  var settings = util.getSettingStore('remotestorage_i18n');

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
        'unauthorized': 'Unauthorized! Click to reconnect.',
        'redirecting': 'Redirecting to <strong>{hostName}</strong>...',
        'typing-hint': 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/">remotestorage.io</a>'
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
        'unauthorized': 'Zugriff fehlgeschlagen. Klicke um neu zu verbinden.',
        'redirecting': 'Leite weiter zu <strong>{hostName}</strong>...',
        'typing-hint': 'Du kannst diese App mit deinem eigenen Cloud-Storage verbinden! Mehr Infos auf <a href="http://remotestorage.io/">remotestorage.io</a>'
      }
    }
  };

  var defaultLocale = 'en';

  var storedLocale = settings.get('locale');

  var currentTable = translations[storedLocale || defaultLocale];

  var NotFound = function(keyPath) {
    this.message = "Translation not found: " + keyPath.join(', ');
  };

  return {
    locales: Object.keys(translations),

    getLocale: function() {
      return settings.get('locale') || defaultLocale;
    },

    setLocale: function(locale) {
      if(! translations[locale]) {
        throw new Error("Locale not found: " + locale);
      }
      currentTable = translations[locale];
      settings.set('locale', locale);
    },

    autoLocale: function() {
      if(storedLocale) {
        return;
      }
      if(typeof(navigator) !== 'undefined') {
        var key = navigator.language.split('-')[0];
        if(key in translations) {
          this.setLocale(key);
        }
      }
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
    },

    clearSettings: settings.clear
  };
});
