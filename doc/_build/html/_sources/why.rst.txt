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
developers having to store or even see their user's data. Thus, developers
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

...

.. rubric:: Footnotes

.. [#f1] Except for apps and use cases that don't require caching, like e.g.
         with `Sharesome <https://sharesome.5apps.com/>`_
.. [#f2] Let's just be honest: nothing lasts forever.
