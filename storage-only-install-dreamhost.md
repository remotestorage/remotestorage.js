These instructions are untested, please help improve them!
-------------------------------

First setup
-----------

- register a domain name with hosting (shared web + email) at DreamHost
- set up a startssl certificate on it
- set up WordPress on it
- set up ownCloud on it

Configuring ownCloud
--------------------

- upload ownCloudApp/core_unhosted/ from this repository into owncloud/apps/
- go into ownCloud as admin and activate the 'Unhosted Web' app

Configuring WordPress
---------------------

- visit https://yourdomain.org/wp-admin/options-permalink.php and choose a format with no '?' in it
- visit https://yourdomain.com/wp-admin/options-general.php and change the site url and WordPress url to https://yourdomain.com/
- visit https://yourdomain.com/wp-admin/plugin-editor.php?file=webfinger/plugin.php and just above 'echo "\n</XRD>";', if 'mich' is your username, paste:
        echo '<Link rel="http://unhosted.org/spec/dav/0.1" href="https://yourdomain.com/owncloud/apps/core_unhosted/compat.php/mich/unhosted/"/>';

Setting up BrowserId
---------------------

- browse to http://myfavoritebeer.org and register your user address (either by creating a new BrowserId account or by choosing 'add new email address')
- go into your DreamHost email and click the confirmation link

Test it
-------

- make sure you're logged into your ownCloud as you.
- now visit http://jacks-todo-app.dev.unhosted.org/ and see if it works
- any problems? please come to our [chat room](http://webchat.freenode.net/?channels=unhosted)
