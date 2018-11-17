Usage in Cordova apps
=====================

`Apache Cordova  <https://cordova.apache.org>`_ is a mobile development
framework. It allows you to use standard web technologies - HTML5, CSS3,
and JavaScript for cross-platform development. Applications execute
within wrappers targeted to each platform, and rely on
standards-compliant API bindings to access each device's capabilities
such as sensors, data, network status, etc. [#f1]_

To use remoteStorage.js in a Cordova app, you need to have the `InAppBrowser plugin
<https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-inappbrowser/>`_
installed.

Cordova apps are packaged for the different platforms and installed on
the device. The app doesn't need to be hosted as a web app (although it
can be as well). But for the remoteStorage connection to work, you need
to provide a page that is accessible via a public URL. This will be used
as the redirect URL during the OAuth flow.

When a user connects their storage, the OAuth dialog will open in an
in-app browser window, set to show the address to prevent phishing attacks.

.. image:: ../_images/cordova_oauth.png
   :width: 188px
   :align: right
   :alt: Screenshot of the OAuth dialog

After the user authorizes the app, the server will redirect to the
configured redirect URL with the authorization token added as a
parameter. remoteStorage.js will intercept this redirect, extract the
token from the URL and close the window.

So the user doesn't actually see the page of the redirect URL and it
does't need to have the remoteStorage.js library included or have any
special logic at all. But you should still make sure that it can be
identified as belonging to your app. Storage providers will usually
show the URL in the OAuth dialog, and they may also link to it (e.g.
from the list of connected apps).

You can configure the redirect URL for your app, either by calling

.. code:: javascript

   remoteStorage.setCordovaRedirectUri('https://myapp.example.com');

or as config when creating your rs instance:

.. code:: javascript

   const remoteStorage = new RemoteStorage({
     cordovaRedirectUri: 'https://myapp.example.com'
   });

No further action is needed and you can now use remoteStorage.js as with
any other web app.

Google Drive config
-------------------

If you wish to use the optional Google Drive adapter, you need to configure a
different user agent for your app. Otherwise the authorization page will show
an error to the user.

In case you haven't set your own UA string already, here's how you can do it:

.. code:: xml

   <preference name="OverrideUserAgent" value="Mozilla/5.0 remoteStorage" />

.. rubric:: Footnotes

.. [#f1] Taken from https://cordova.apache.org/docs/en/latest/guide/overview/index.html
