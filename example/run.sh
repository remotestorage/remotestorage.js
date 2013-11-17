#echo Generating self-signed cert:
#openssl req -subj '/CN=remoteStorage example server/' -newkey rsa:2048 -new -x509 -days 3652 -nodes -out server/tls.cert -keyout server/tls.key
echo Starting server:
cd server/ ; sudo node server.js
