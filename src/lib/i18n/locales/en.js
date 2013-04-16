define([], function() {
  return {
    strings: {
      widget: {
        // Bubble text in initial state
        'connect-remotestorage': 'Connect <strong>remoteStorage</strong>',
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
        'typing-hint': 'This app allows you to use your own storage! Find more info on <a href="http://remotestorage.io/" target="_blank">remotestorage.io</a>',
        'last-synced': '{t}',
        'webfinger-failed': "{message}",
        'webfinger-error-no-at': "The user address doesn’t seem to be correct, there is no @-sign in it.",
        'webfinger-error-multiple-at': "The user address doesn’t seem to be correct, there is more than one @-sign in it.",
        'webfinger-error-non-dotalphanum': "The user address doesn’t seem to be correct, there are invalid characters in it.",
        'webfinger-error-invalid-xml': 'The server doesn’t seem to support remoteStorage. Please update it, and <a href="http://remotestorage.io/community/" target="_blank">let us know</a> if you need help.',
        'webfinger-error-invalid-jrd': 'The server doesn’t seem to support remoteStorage. Please update it, and <a href="http://remotestorage.io/community/" target="_blank">let us know</a> if you need help.',
        'webfinger-error-not-supported': 'The server doesn’t seem to support remoteStorage. Please update it, and <a href="http://remotestorage.io/community/" target="_blank">let us know</a> if you need help.',
        'webfinger-error-requests-failed': 'Oops, we couldn’t find the remoteStorage server. Are you sure the address is correct?',
        'webfinger-error-timeout': 'Oops, the remoteStorage server didn’t reply. Are you sure the address is correct?',
        'error': 'Sorry! An error occurred.',
        // reset button
        'reset': "Okay, get me out of here",
        'error-info': 'If this problem persists, please <a href="http://remotestorage.io/community/" target="_blank">let us know</a>!',
        'reset-confirmation-message': "Are you sure you want to reset everything? That will probably make the error go away, but also clear your entire localStorage and reload the page. Please make sure you know what you are doing, before clicking 'yes' :-)"
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
