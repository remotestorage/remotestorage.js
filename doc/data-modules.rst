Data modules
============

A core idea of the remoteStorage protocol is that the same data can be used by
multiple apps. Imagine creating a to-do in one app, and tracking time on it in
another.

Traditional Web apps make this possible with custom, proprietary APIs, which are
dependent on the app provider. Third party developers usually need to
register an application with the original provider to access that data via the
API, and this access can be revoked at any time. remoteStorage and `unhosted web apps
<https://unhosted.org>`_ in general give end users ultimate control over which
apps have access to their data.

In order to make it easy and safe for your app data to be compatible with other
apps, we created the concept of data modules for rs.js, which can be shared and
developed collaboratively in the open.

Data modules can contain as much or as little functionality as desired, from
defining data formats and types to data validation, formatting, processing,
transformation, encryption, indexing, and other use cases.

Data modules make your app and its data interoperable with other apps. Sharing
your modules is generally encouraged, but it is also possible to encapsulate custom
functionality in a custom module made just for your app.

.. toctree::
   :caption: Contents
   :maxdepth: 2

   data-modules/defining-a-module
   data-modules/defining-data-types
   data-modules/publishing-and-finding-modules
