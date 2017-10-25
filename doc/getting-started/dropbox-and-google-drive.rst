Offering Dropbox and Google Drive as a storage option
=====================================================

remoteStorage.js optionally enables app developers to let users store their
app data in Dropbox or Google Drive instead of a RemoteStorage server.

You need to set your API keys for Dropbox and/or your Client ID for Google
Drive::

   remoteStorage.setApiKeys({
     dropbox: 'your-app-key',
     googledrive: 'your-client-id'
   });

You can set just one if you want.

The :doc:`Connect widget</getting-started/connect-widget>`
will automatically show only the available storage options, based on the
presence of the `dropbox` and `googledrive` API keys. RemoteStorage is always
enabled.

Dropbox
-------

An app key can be obtained by `registering your app <https://www.dropbox.com/developers/apps>`_

* Create a new app using the "Dropbox API", using "Full Dropbox access", give
  it a name.
* You will need to set a OAuth2 redirect URI, for example
  ``http://localhost:8001/`` for an app you are developing locally.

Known issues
^^^^^^^^^^^^

* Storing files larger than 150MB is not yet supported
* Listing and deleting folders with more than 10000 files will cause problems
* Content-Type is not fully supported due to limitations of the Dropbox API
* Dropbox preserves cases but is not case-sensitive
* ``getItemURL`` is asynchronous which means it returns useful values
  after the syncCycle

Google Drive
------------

A client ID can be obtained by registering your app in the `Google Developers
Console <https://console.developers.google.com/flows/enableapi?apiid=drive>`_

* Create an API, then add credentials for Google Drive API. Specify you will be
  calling the API from a "Web browser (Javascript)" project. Select that you
  want to access "User data".
* On the next screen, fill out the Authorized JavaScript origins and Authorized
  redirect URIs for your app.
* Once your app is running in production, you will want to get verified by
  Google to avoid warnings that the app was not verified when the user connects
  their account

