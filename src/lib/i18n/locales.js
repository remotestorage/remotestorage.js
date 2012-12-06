define([
  './locales/en',
  './locales/de'
], function(en, de) {
  return {
    translations: {
      en: en.strings,
      de: de.strings
    },

    helpers: {
      en: en.helpers,
      de: de.helpers
    }
  }
});