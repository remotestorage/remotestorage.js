First setup
-----------

    ssh root@myfavouritesandwich.org
    [type password]
        1  mkdir .ssh
        2  exit
    scp .ssh/id_rsa.pub root@myfavouritesandwich.org:.ssh/
    [type password]
        3  apt-get update
        4  apt-get upgrade
        5  vim /var/www/index.html 
    [set an 'in maintenance' message]

Set up https
------------

        6 mkdir /var/www/no-ssl
        7 vim /var/www/no-ssl/index.html
    [edit:]
    <html>
    <script>
    document.location="https://myfavouritesandwich.org"
    </script>
    </html>
    scp ~/ssl-cert/* root@myfavouritesandwich.org:
        8  a2ensite default-ssl
        9  vim /etc/apache2/sites-enabled/default-ssl
    [edit:]
            SSLCertificateFile    /root/ssl.crt
            SSLCertificateKeyFile /root/ssl.key
    [and:]
            SSLCertificateChainFile /root/sub.class1.server.ca.pem
    [and while you have the file open, this is needed for both ownCloud and WordPress:]
        AllowOverride All
       10  vim /etc/apache2/sites-enabled/000-default
    [edit:]
            DocumentRoot /var/www/no-ssl
       11  /etc/init.d/apache2 restart

Set up ownCloud
---------------

       12  apt-get install libapache2-mod-php5
       13  apt-get install mysql-server
    [choose mysql root password]
       14  apt-get install git
       15  git clone git://anongit.kde.org/owncloud
       16  mv owncloud/ /var/www
       17  apt-get install php5-mysql
       18  /etc/init.d/apache2 restart
       19  chown www-data /var/www/owncloud/
       20  chown www-data /var/www/owncloud/config/
    [browse to http://myfavouritesandwich.org/owncloud/ and follow setup wizard]
       21  git clone git@github.com:unhosted/unhosted.git
       22  ssh-keygen -t rsa -C "root@myfavouritesandwich.org"
       23  cat .ssh/id_rsa.pub 
    [paste it into ssh-keys tab of github account settings]
       24  git clone git@github.com:unhosted/unhosted.git
       25  cd unhosted/
       26  git checkout devel
       27  git branch devel
       28  git pull devel
       29  git pull
       30  git checkout devel
    [not sure which one of these worked!]
       31  cp -r ownCloudApp/core_unhosted/ /var/www/owncloud/apps/core_unhosted
    [go into ownCloud as admin and activate the 'Unhosted Web' app]


Set up WordPress
----------------

       32  cd
       33  wget http://wordpress.org/latest.tar.gz
       34  tar -xzvf latest.tar.gz 
       35  mv wordpress/* /var/www/
       36  cd /var/www
       37  mysql -p
    create database wordpress;
    exit;
    [browse to http://myfavouritesandwich.org/index.php and follow setup wizard]
       38  vim wp-config.php
    [paste config from setup wizard]
       39  mv index.html maintenance.html
    [in wordpress dashboard, add a wordpress blogpost explaining maintenance]
    [in wordpress dashboard, install and activate plugins: well-known, host-meta, webfinger]
       40  touch /var/www/.htaccess
       41  chown www-data /var/www/.htaccess
       42  /etc/init.d/apache2 restart
    [visit https://myfavouritesandwich.org/wp-admin/options-permalink.php and choose a format with no '?' in it]
    [visit https://myfavouritesandwich.org/wp-admin/options-general.php and change the site url and WordPress url to https://myfavouritesandwich.org/]
    [visit https://myfavouritesandwich.org/wp-admin/plugin-editor.php?file=webfinger/plugin.php and just above 'echo "\n</XRD>";', if 'mich' is your username, paste:]
        echo '<Link rel="http://unhosted.org/spec/dav/0.1" href="https://myfavouritesandwich.org/owncloud/apps/core_unhosted/compat.php/mich/unhosted/"/>';

Set up node
-----------
       43 apt-get install python g++ libssl-dev make
    [follow instructions on https://github.com/joyent/node/wiki/Installation step 3a]

Set up BrowserId
----------------
       44 cd /root/unhosted/browsermail
       45 vim server.js
     [replace hard-coded 'mich@myfavouritesandwich.org' with your own user address]
       45 node server.js
    [browse to http://myfavouritesandwich.org:8001 - you should see a message like 'raw MIME emails will appear here'.]
    [browse to http://myfavoritebeer.org and register your user address]
    [go back to your browsermail tab, copy the link from the email, and paste it, carefully removing the '3D' from '?token=3D...' bit]
