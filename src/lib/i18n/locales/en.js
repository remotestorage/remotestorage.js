define([], function() {
  return {
    strings: {
      widget: {
        // Bubble text in initial state
        'connect-remotestorage': 'Connect <strong>remotestorage</strong>',
        // Connect button label
        'connect': 'connect',
        'sync': 'sync',
        'disconnect': 'disconnect',
        'permissions': 'Permissions',
        'all-data': 'All data',
        'synchronizing': 'Syncing <strong>{userAddress}</strong>',
        'connecting': 'Connecting <strong>{userAddress}</strong>',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Unauthorized! Click to reconnect.',
        'redirecting': 'Redirecting to <strong>{hostName}</strong>',
        'typing-hint': 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/">remotestorage.io</a>',
        'last-synced': 'Synced {t}',
        'webfinger-failed': "{message}",
        'webfinger-error-no-at': "There is no @-sign in the user address.",
        'webfinger-error-multiple-at': "There is more than one @-sign in the user address.",
        'webfinger-error-non-dotalphanum': "There are invalid characters in the user address.",
        'webfinger-error-invalid-xml': "Server doesn't support remotestorage.",
        'webfinger-error-invalid-jrd': "Server doesn't support remotestorage.",
        'webfinger-error-requests-failed': "Failed to contact the storage server.",
        'webfinger-error-not-supported': "Server doesn't support remotestorage.",
        'error': 'Sorry! An error occurred.'
      }
    },

    helpers: {
      timeAgo: function(usec) {
        function format(time, unit) {
          time = Math.round(time);
          if(time != 1) {
            unit += 's';
          }
          return time + ' ' + unit + ' ago';
        }
        var sec = usec / 1000;
        if(sec > 3600) {
          return  format(sec / 3600, 'hour')
        } else if(sec > 60) {
          return format(sec / 60, 'minute');
        } else if(sec < 5) {
          return 'just now';
        } else {
          return format(sec, 'second');
        }
      }
    }
  };
});
