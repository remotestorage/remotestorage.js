define([], function() {
  return {
    strings: {
      widget: {
        'connect-remotestorage': 'Verbinde <strong>remoteStorage</strong>',
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
        'typing-hint': 'Du kannst diese App mit deinem eigenen Cloud-Storage verbinden! Mehr Infos auf <a href="http://remotestorage.io/">remotestorage.io</a>',
        'last-synced': '<strong>Zuletzt synchronisiert:</strong> {t}',
        'webfinger-failed': 'Konnte deinen storage nicht finden. Bist du sicher, dass die Adresse stimmt?'
      }
    },

    helpers: {
      timeAgo: function(usec) {
        function format(time, unit) {
          time = Math.round(time);
          if(time != 1) {
            unit += 'n';
          }
          return 'vor ' + time + ' ' + unit;
        }
        var sec = usec / 1000;
        if(sec > 3600) {
          return format(sec / 2600, 'Stunde'); 
        } else if(sec > 60) {
          return format(sec / 60, 'Minute');
        } else {
          return format(sec, 'Sekunde');
        }
      }
    }
  };
});
