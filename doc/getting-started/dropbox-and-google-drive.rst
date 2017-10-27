Offering Dropbox and Google Drive storage options
=================================================

.. image:: ../_images/screenshot-widget-choose.png
   :width: 195px
   :align: right
   :alt: Screenshot of the connect-widget choose-backend screen

rs.js has optional support for syncing data with Dropbox and Google Drive
instead of a RemoteStorage server.

There are a few drawbacks, mostly sync performance and the lack of a permission
model. So apps can usually access all of a user's storage with these backends
(vs. only relevant parts of the storage with RS accounts).  However, while RS
is not a widely known and deployed protocol, we find it helpful to let users
choose something they already know, and potentially migrate to an RS account
later on.

For these additional backends to work, you will have to register your app with
Dropbox and/or Google first. Then you can configure your OAuth app ID/key like
so::

   remoteStorage.setApiKeys({
     dropbox: 'your-app-key',
     googledrive: 'your-client-id'
   });

.. HINT::
   The :doc:`Connect widget</getting-started/connect-widget>`
   will automatically show only the available storage options, based on the
   presence of the `dropbox` and `googledrive` API keys. RemoteStorage is always
   enabled.

Dropbox
-------

An app key can be obtained by `registering your app
<https://www.dropbox.com/developers/apps>`_.

* Create a new app for the "Dropbox API", with "Full Dropbox access"
* You need to set one or more OAuth2 redirect URIs for all routes a user can
  connect from, for example ``http://localhost:8000/`` for an app you are
  developing locally.

Known issues
^^^^^^^^^^^^

* Storing files larger than 150MB is not yet supported
* Listing and deleting folders with more than 10000 files will cause problems
* Content-Type is not fully supported due to limitations of the Dropbox API
* Dropbox preserves cases but is not case-sensitive
* ``getItemURL`` is not implemented yet (see issue :issue:`1052`)

Google Drive
------------

A client ID can be obtained by registering your app in the `Google Developers
Console <https://console.developers.google.com/flows/enableapi?apiid=drive>`_.

* Create an API, then add credentials for Google Drive API. Specify you will be
  calling the API from a "Web browser (Javascript)" project. Select that you
  want to access "User data".
* On the next screen, fill out the Authorized JavaScript origins and Authorized
  redirect URIs for your app (for every route a user can connect from, same as
  with Dropbox)
* Once your app is running in production, you will want to get verified by
  Google to avoid a security warning when the user first connects their account

Known issues
^^^^^^^^^^^^

* Sharing public files is not supported yet (see issue :issue:`1051`)
* ``getItemURL`` is not implemented yet (see issue :issue:`1054`)
