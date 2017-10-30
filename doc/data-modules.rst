Data modules
============

One of the core ideas of the remoteStorage protocol, and one of its unique
features, is that data shouldn't be locked into a single app. Why not create a
to-do in one app, but track time on it in another one for example?

With traditional Web apps, this is only possible by implementing custom,
proprietary APIs, which make you entirely dependent on the app provider. Also,
for other app developers to access that data via the API, they usually have to
register an application with the original provider, who can revoke this access
at any point. However, with remoteStorage, and `unhosted web apps
<https://unhosted.org>`_ in general, end users have ultimate control over which
apps have access to their data.

In order to make it easy and safe for your app data to be compatible with other
apps, we created the concept of data modules for rs.js, which can be shared and
collaboratively developed in the open.

Data modules can contain as much or little functionality as necessary or
desired, not just defining data formats and types, but also handling for
example data validation, formatting, processing, transformation, encryption,
indexing, and whatever else you may come up with.

Thus, modules are not only useful for making your data/app compatible with
others, but also to encapsulate functionality you might only want to use in a
custom module in your own app. And although sharing your data module(s) is
certainly encouraged, it is by no means required, of course.

.. toctree::
   :caption: Contents
   :maxdepth: 2

   data-modules/defining-a-module
   data-modules/defining-data-types
   data-modules/publishing-and-finding-modules
