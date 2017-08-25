When the library loads, it checks the fragment of the URL to see if
an `access_token` or `remotestorage` parameter exist there. In the
first case, the access token is given to the remote using `remoteStorage.remote.configure`.
In the second case, webfinger discovery is triggered for the user
address given (see storage-first section of the remoteStorage spec)

The user can also set the user address through the widget, or the app
can call `remoteStorage.remote.configure` to set the user address.

When a user address is set, but no other remote parameters are known yet,
WebFinger discovery will be triggered. From there, the library gets
the storage base URL, the storage API, and the OAuth dialog URL.

If no OAuth URL is given, Implied Auth is triggered:
https://github.com/remotestorage/remotestorage.js/issues/782

If an OAuth URL is known, but no token yet, the OAuth dance will be
triggered by setting the `location.href` of the window. When the dance
comes back, the library will detect the `access_token` from the window
location during the page load, and from that point onwards, the remote
is connected.
