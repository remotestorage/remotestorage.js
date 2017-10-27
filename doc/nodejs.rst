Usage with Node.js
==================

Although remoteStorage.js was initially written for being used in browsers, we
do support using it in a Node.js environment as well. See :doc:`this section
</getting-started>` for getting started.

The main difference between rs.js in a browser and using it on a server or in a
CLI program is how to connect a storage. The RS protocol uses the OAuth
Implicit Grant flow for clients to receive a bearer token, which they can use
in HTTP requests.  This works by redirecting back to the Web application with
the token attached to the redirect URI as a URI fragment.

Now, with rs.js in a browser, calling
``remoteStorage.connect('user@example.com')`` will take care of the entire
OAuth process, including the parsing of the URI after the redirect, saving the
token to localStorage and changing the library's state to connected. But in a
node.js program, that's obviously not possible, because there's no browser that
will open the OAuth dialog and receive the redirect with the token attached to
the redirect URI.

connect() with a token
----------------------

For this reason, among others, you can call the connect function with a token
that you acquired beforehand::

   remoteStorage.connect('user@example.com', 'abcdefghijklmnopqrstuvwxyz')

This will skip the entire OAuth process, because you did that before in some
other way, of course.

Obtaining a token
-----------------

For some programs, like e.g. a server daemon, you can usually acquire the token
from your server manually, and then just configure it for example as
environment variable, when running your program.

For CLI programs, and if you actually want to integrate the OAuth flow in your
program, one possible solution is the following:

1. Set up a simple Web site/app, which you publish under a fitting domain/URI
   that you can use as the OAuth redirect URI.
2. Have the user enter their user address and do a Webfinger lookup for auth
   URL etc., e.g. using `webfinger.js
   <https://www.npmjs.com/package/webfinger.js>`_.
3. Create the OAuth request URI with the correct scope etc., and open a browser
   window with that URI from your program (or prompt the user to open it).
4. Have the Web app, which the user is being redirected to, show the token to
   the user, in order for them to copy and enter in your program
5. Connect with that token.

You can find a complete example for this process in `rs-backup`_, a
remoteStorage backup CLI program. In particular `its code for connecting a
storage <https://github.com/skddc/rs-backup/blob/v1.5.0/backup.js#L137-L160>`_
and the `simple Web page <https://github.com/skddc/rs-backup-auth-page>`_ its
using for the redirect.

.. HINT::
   rs-backup is not using remoteStorage.js at all, which you might also want to
   consider as an option when writing non-browser applications.

Caveats
-------

* IndexedDB and localStorage are not supported by default in Node.js, so the
  library will fall back to in-memory storage for caching data locally. This
  means that unsynchronized data will be lost between sessions and program
  executions.

Examples
--------

* `hubot-remotestorage-logger`_, a Hubot script that logs chat messages to
  remoteStorage-enabled accounts using the `chat-messages`_ module

.. _hubot-remotestorage-logger: https://github.com/67P/hubot-remotestorage-logger
.. _chat-messages: https://www.npmjs.com/package/remotestorage-module-chat-messages
.. _rs-backup: https://github.com/skddc/rs-backup
