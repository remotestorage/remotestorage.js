define([
  './util',
  './i18n/locales'
], function(util, locales) {

  // Namespace: i18n
  //
  // Internationalization & Localization for remoteStorage.js
  //

  var settings = util.getSettingStore('remotestorage_i18n');

  var translations = locales.translations;
  var helpers = locales.helpers;

  var defaultLocale = 'en';
  var storedLocale = settings.get('locale');

  var currentTable = translations[storedLocale || defaultLocale];

  var NotFound = function(keyPath) {
    this.message = "Translation not found: " + keyPath.join(', ');
  };

  var UndefinedLocale = function(locale) {
    Error.apply(this, ["Locale not defined: " + locale]);
  };
  UndefinedLocale.prototype = Error.prototype;

  return {

    // Property: helpers
    // Object of helpers for i18n/l10n.
    // Do not cache or extend this property, it gets replaced when the locale
    // changes.
    //
    // Methods:
    //   timeAgo(usec) - Example: timeAgo(3000); // -> "3 seconds ago"
    //
    helpers: helpers[storedLocale || defaultLocale],

    // Property: defaultLocale
    // Default locale to use when detection fails.
    // Initially set to 'en'.
    defaultLocale: defaultLocale,

    // Property: locales
    // Array of available locales.
    locales: Object.keys(translations),

    // Method: getLocale
    // Get currently used locale.
    getLocale: function() {
      return settings.get('locale') || this.defaultLocale;
    },

    // Method: setLocale
    // Set locale.
    //
    // Parameters:
    //   locale - A string. Must be included in <locales>.
    //
    // Throws <UndefinedLocale> when the locale is unknown.
    setLocale: function(locale) {
      if(! (locale in translations)) {
        throw new Error("Locale not found: " + locale);
      }
      currentTable = translations[locale];
      this.helpers = helpers[locale];
      settings.set('locale', locale);
    },

    // Method: autoDetect
    // Automatically determines and sets locale.
    // This won't overwrite a stored locale.
    autoDetect: function() {
      var locale;
      ( storedLocale || (
        (locale = this.detectLocale()) &&
          (locale in translations) &&
          this.setLocale(locale) ) );
    },

    // Method: detectLocale
    //
    // Detects current locale from environment.
    //
    // Sources:
    //   (nodejs)  - process.env.LANG
    //   (browser) - navigator.language
    //
    // Returns:
    //   a locale string or undefined.
    detectLocale: function() {
      var key;
      if(typeof(navigator) !== 'undefined') {
        key = navigator.language.split('-')[0];
      } else if(typeof(process) !== 'undefined') {
        var lang = process.env.LANG;
        if(lang) {
          key = lang.split('_')[0];
        }
      }
      return key;
    },

    // Method: t
    // Look up a translation.
    //
    // Parameters:
    //   (any number of strings) - list of keys to follow in translation tree
    //   variables - (optional) Object, containing variables to replae.
    //
    // Example:
    //   (start code)
    //   // given the translations are as follows:
    //   {
    //     "a": {
    //       "b": {
    //         "c": "Hello {who}!"
    //       }
    //     }
    //   }
    //
    //   // Then the following call:
    //   i18n.t('a', 'b', 'c', { who: 'World' });
    //
    //   // returns:
    //   "Hello World!"
    //
    //
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
            console.log("Translation not found in ", result, '(', currentTable, ')', keys, key, index);
            throw new NotFound(keys.slice(0, index + 1));
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

    // Method: clearSettings
    // Clear cached locale settings.
    // Doesn't reset the current in-memory state
    // (i.e. current locale and default locale)
    clearSettings: settings.clear,

    // Exception: UndefinedLocale
    // Thrown when trying to set a locale that isn't defined.
    //
    // Own properties:
    //   locale - the locale string as passed to <setLocale>
    UndefinedLocale: UndefinedLocale
  };
});
