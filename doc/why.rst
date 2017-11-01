Why use this?
=============

Offline-first design
--------------------

rs.js is offline-first by design, meaning data is stored locally first [#f1]_,
and synced to and from a remote storage account second. This makes it a robust
sync solution for mobile applications, where slow and spotty network
connections are a normal situation.

It's also useful, when a backend goes down, as users can just keep using their
app and have their data automatically synced whenever the server is back
online.

Zero backend
------------

rs.js is built for creating fully `unhosted`_ apps. Meaning users are able to
connect their own storage account to apps on their devices, without app
developers having to store or even see their users' data. Thus, developers
don't have to integrate, manage, maintain and secure a storage server or cloud.

A nice side effect of this design is that your app can scale to millions of
users with literally *zero* cost for storage.

Also, in case you decide to abandon your app [#f2]_, users can continue to use
it across devices until they switch to a new one on their own time. You may
even reverse your decision at some point and still have a lot of your users
right there.

.. _unhosted: https://remotestorage.io/#explainer-unhosted

Data sharing
------------

Different apps can access the same data, so you can build an app that uses and
manipulates existing data, without building import/export features or having
users start over from scratch.

Even better, you can get advanced capabilities for free by using shared,
open-source :doc:`data modules </data-modules>`, which you can cooperate on
with other developers.

For example: if you want to enable users to share files from their storage
account in your app, you can just integrate the `shares module`_ within a
matter of minutes, giving you client-side thumbnail generation and other
features in the process.

.. _shares module: https://github.com/skddc/remotestorage-module-shares

Reliability
-----------

The very first prototype of rs.js has been written in November 2010. Since
then, it has been used, tested, stabilized, and improved in more than 4000
commits. The library has been used in commercial apps by hundreds of thousands
of users, and in countries around the globe. We have seen pretty much every
device, browser, privacy setting and network connection there is, and fixed
bugs and issues for most of them.

In short: you can rely on rs.js to do its job. And if you do find a critical
bug, there's a team of people who will help with fixing it.

One JS API for multiple storage options
---------------------------------------

rs.js optionally supports Dropbox and Google Drive as storage backends which
users can connect. Conveniently, as an app developer you don't have to
implement anything special in order for these backends to work with your code
[#f3]_. Just :doc:`configure OAuth app keys
</getting-started/dropbox-and-google-drive>`, and your users can choose between
3 different backends to connect.

.. rubric:: Footnotes

.. [#f1] Except for apps and use cases that don't require caching, like e.g.
         with `Sharesome <https://sharesome.5apps.com/>`_
.. [#f2] Let's just be honest: nothing lasts forever.
.. [#f3] Except adding UI for it, in case you're not using the :doc:`connect
         widget</getting-started/connect-widget>`, of course.
