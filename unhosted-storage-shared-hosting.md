First setup
-----------

- choose a shared hosting provider somewhere. make sure they offer php+mysql and preferably one-click wordpress. For example, HostGator.
- register a domain name with hosting somewhere.

Set up https
------------

- if you are not too fussed about security, you can skip this
- get an ssl certificate from for instance startssl, and set it up
- visit https://yourdomain.com/wp-admin/options-general.php and change the site url and WordPress url to https://yourdomain.com/

Configuring WordPress
---------------------

- set up WordPress from the control panel (at HostGator, the one-click install worked, although we needed to [hack into our own admin user](http://support.hostgator.com/articles/specialized-help/technical/wordpress/admin-login-for-wordpress-and-other-programs))
- visit https://yourdomain.org/wp-admin/options-permalink.php and choose a format with no '?' in it (at HostGator this was already the case)
- add the /.well-known/ plugin
- add the host-meta plugin
- add the webfinger plugin
- visit https://yourdomain.com/wp-admin/plugin-editor.php?file=webfinger/plugin.php and just above 'echo "\n</XRD>";' (about 40% down), if 'mich' is your username, paste:
        echo '<Link rel="http://unhosted.org/spec/dav/0.1" href="https://yourdomain.com/owncloud/apps/unhosted/compat.php/mich/unhosted/"/>';

Setting up BrowserId
---------------------

- browse to http://myfavoritebeer.org and register your user address (either by creating a new BrowserId account or by choosing 'add new email address')
- go into your DreamHost email and click the confirmation link

Configuring ownCloud
--------------------

- install ownCloud. You can probably upload the tar ball and unpack it on the server. I must admit that I gave up while trying to get this working. But it should be possible. If you have trouble with this, you can ask for help in the [ownCloud chat room](http://webchat.freenode.net/?channels=owncloud) or check their [wiki](http://owncloud.org/index.php/Installation#Common_problems_.26_solutions) or their [shapado page](http://owncloud.shapado.com/).
- upload ownCloudApp/core_unhosted/ from this repository into owncloud/apps/
- go into ownCloud as admin and activate the 'Unhosted Web' app

Test it
-------

- make sure you are logged into your ownCloud as you.
- now visit http://jacks-todo-app.dev.unhosted.org/ and see if it works
- any problems? please come to our [chat room](http://webchat.freenode.net/?channels=unhosted)
