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
        'synchronizing': 'Synchronizing <strong>{userAddress}</strong>',
        'connecting': 'Connecting <strong>{userAddress}</strong>...',
        'offline': '<strong>{userAddress}</strong> (offline)',
        'unauthorized': 'Unauthorized! Click to reconnect.',
        'redirecting': 'Redirecting to <strong>{hostName}</strong>...',
        'typing-hint': 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/">remotestorage.io</a>',
        'last-synced': '<strong>Last synced:</strong> {t}',
        'webfinger-failed': "Failed to connect to storage server: {message}",
        'webfinger-error-no-at': "there is no @-sign in the user address.",
        'webfinger-error-multiple-at': "there is more than one @-sign in the user address.",
        'webfinger-error-non-dotalphanum': "there is more than one @-sign in the user address.",
        'webfinger-error-invalid-xml': "the XML returned by the server is invalid",
        'webfinger-error-invalid-jrd': "the JRD returned by the server is invalid",
        'webfinger-error-requests-failed': "failed to contact the storage server"
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
        } else {
          return format(sec, 'second');
        }
      }
    }
  };
});
