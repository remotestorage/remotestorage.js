# Data modules

A core idea of the remoteStorage protocol is that the same data can be
used by multiple apps. Imagine creating a to-do in one app, and tracking
time on it in another.

Traditional Web apps make this possible with custom, proprietary APIs,
which are dependent on the app provider. Third party developers usually
need to register an application with the original provider to access
that data via the API, and this access can be revoked at any time.

remoteStorage apps (and [unhosted web apps](https://unhosted.org) in general)
give end users ultimate control over which apps have access to their data. This
makes users more independent from single app providers, and ensures that any
app developer can create new apps for users' existing data.

In order to make it easy and safe for your app data to be compatible with other
apps, we created the concept of data modules for remoteStorage.js. They are
little add-on libraries, which can be shared between apps and developers, and
that ideally are developed collaboratively in the open.

Data modules can contain as much or as little functionality as desired,
from defining data formats and types, to data validation, formatting,
processing, transformation, encryption, indexing, and other use cases.

Data modules make your app and its data interoperable with other apps.
Sharing your modules is generally encouraged, but it's also possible to
encapsulate custom functionality in a custom module made just for your
app.
