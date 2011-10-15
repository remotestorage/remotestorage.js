echo $1
curl -i -H "Content-Type: text/plain" -H "X-Upload-Content-Length: 30" -H "X-Upload-Content-Type: text/plain" -H "origin: http://myfavouritesandwich.org" -H "GData-Version: 3.0" -H "Authorization: Bearer $1" -H "Slug: remoteStorage-curl" -H "Content-Length: 0" -X POST -d "" https://docs.google.com/feeds/default/private/full
