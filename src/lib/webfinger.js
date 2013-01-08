define(
  ['./platform', './util'],
  function (platform, util) {

    "use strict";

    // Namespace: webfinger
    //
    // Webfinger discovery.
    // Supports XRD, JRD and the <"resource" parameter at http://tools.ietf.org/html/draft-jones-appsawg-webfinger-06#section-5.2>
    //
    // remoteStorage.js tries the following things to discover a user's profile:
    //   * via HTTPS to /.well-known/host-meta.json
    //   * via HTTPS to /.well-known/host-meta
    //   * via HTTP to /.well-known/host-meta.json
    //   * via HTTP to /.well-known/host-meta
    //
    //   All those requests carry the "resource" query parameter.
    //
    // So in order for a discovery to work most quickly, a server should
    // respond to HTTPS requests like:
    //
    //   > /.well-known/host-meta.json?resource=acct%3Abob%40example.com
    // And return a JSON representation of the profile, such as this:
    //
    //   (start code)
    //
    //   {
    //     links:[{
    //       href: 'https://example.com/storage/bob',
    //       rel: "remoteStorage",
    //       type: "https://www.w3.org/community/rww/wiki/read-write-web-00#simple",
    //       properties: {
    //         'auth-method': "https://tools.ietf.org/html/draft-ietf-oauth-v2-26#section-4.2",
    //         'auth-endpoint': 'https://example.com/auth/bob'
    //       }
    //     }]
    //   }
    //
    //   (end code)
    //

    var logger = util.getLogger('webfinger');

      ///////////////
     // Webfinger //
    ///////////////

    // PARSE

    // parse user address
    function extractHostname(userAddress) {
      var parts = userAddress.toLowerCase().split('@');
      var error;
      if(parts.length < 2) {
        error = 'That is not a user address. There is no @-sign in it';
      } else if(parts.length > 2) {
        error = 'That is not a user address. There is more than one @-sign in it';
      } else {
        if(!(/^[\.0-9a-z\-\_]+$/.test(parts[0]))) {
          error = 'That is not a user address. There are non-dotalphanumeric symbols before the @-sign: "'+parts[0]+'"';
        } else if(!(/^[\.0-9a-z\-]+$/.test(parts[1]))) {
          error = 'That is not a user address. There are non-dotalphanumeric symbols after the @-sign: "'+parts[1]+'"';
        }
      }
      if(error) {
        throw error;
      }
      return parts[1];
    }

    function parseXRD(str) {
      var promise = util.getPromise();
      platform.parseXml(str, function(err, obj) {
        if(err) {
          promise.fail(err);
        } else {
          if(obj && obj.Link) {
            var links = {};
            if(obj.Link && obj.Link['@']) {//obj.Link is one element
              if(obj.Link['@'].rel) {
                links[obj.Link['@'].rel]=obj.Link['@'];
              }
            } else {//obj.Link is an array
              for(var i=0; i<obj.Link.length; i++) {
                if(obj.Link[i]['@'] && obj.Link[i]['@'].rel) {
                  links[obj.Link[i]['@'].rel]=obj.Link[i]['@'];
                }
              }
            }
            promise.fulfill(links);
          } else {
            promise.fail('found valid xml but with no Link elements in there');
          }
        }
      });
      return promise;
    }

    function parseJRD(data) {
      var object = JSON.parse(data);
      if(! object.links) {
        throw new Error('JRD contains no links: ' + JSON.stringify(object));
      }
      var links = {};
      object.links.forEach(function(link) {
        // just take the first one of each rel:
        if(link.rel && (! links[link.rel])) {
          links[link.rel] = link;
        }
      });
      return links;
    }

    // request a single profile
    function fetchProfile(address, timeout) {
      console.log('fetch profile', address, timeout);
      return platform.ajax({
        url: address,
        timeout: timeout
      }).then(function(body, headers) {
        var mimeType = headers && headers['content-type'] && headers['content-type'].split(';')[0];
        console.log('fetched', body, mimeType);
        if(mimeType && mimeType.match(/^application\/json/)) {
          return parseJRD(body);
        } else {
          return util.makePromise(function(jrdPromise) {
            parseXRD(body).then(
              function(xrd) {
                jrdPromise.fulfill(xrd);
              }, function(error) {
                jrdPromise.fulfill(parseJRD(body));
              });
          });
        }
      });
    }

    // fetch profile from all given addresses and yield the first one that
    // succeeds.
    function fetchHostMeta(addresses, timeout) {
      console.log('fetch host meta', addresses, timeout);
      return util.asyncMap(addresses, util.rcurry(fetchProfile, timeout, true)).
        then(function(profiles, errors) {
          console.log('host meta mapped', profiles);
          for(var i=0;i<profiles.length;i++) {
            if(profiles[i]) {
              return profiles[i];
            }
          }
          throw new Error(
            "Failed to fetch webfinger profile. All requests failed."
          );
        });
    }

    function extractRemoteStorageLink(links) {
      console.log('extract remoteStorage link', links);
      var remoteStorageLink = links.remoteStorage || links.remotestorage;
      var lrddLink;
      if(remoteStorageLink) {
        console.log('remoteStorageLink', remoteStorageLink);
        if(remoteStorageLink.href &&
           remoteStorageLink.type &&
           remoteStorageLink.properties &&
           remoteStorageLink.properties['auth-endpoint']) {
          return remoteStorageLink;
        } else {
          throw new Error("Invalid remoteStorage link. Required properties are:" +
                          "href, type, properties, properties.auth-endpoint. " +
                          JSON.stringify(remoteStorageLink));
        }
      } else if(lrddLink = links.lrdd) {
        return fetchProfile(
          lrddLink.template.replace('{uri}', 'acct:' + userAddress)
        ).then(extractRemoteStorageLink);
      }
    }

    // method: getStorageInfo
    // Get the storage information of a given user address.
    //
    // Parameters:
    //   userAddress - a string in the form user@host
    //   options     - see below
    //   callback    - to receive the discovered storage info
    //
    // Options:
    //   timeout     - time in milliseconds, until resulting in a 'timeout' error.
    //
    // Callback parameters:
    //   err         - either an error message or null if discovery succeeded
    //   storageInfo - the format is equivalent to that of the JSON representation of the remotestorage link (see above)
    //
    function getStorageInfo(userAddress, options) {

      /*

        - validate userAddres
        - fetch host-meta
        - parse host-meta
        - (optionally) fetch lrdd
        - (optionally) parse lrdd
        - extract links

       */

      var hostname = extractHostname(userAddress)
      var query = '?resource=acct:' + encodeURIComponent(userAddress);
      var addresses = [
        'https://' + hostname + '/.well-known/host-meta.json' + query,
        'https://' + hostname + '/.well-known/host-meta' + query,
        'http://'  + hostname + '/.well-known/host-meta.json' + query,
        'http://'  + hostname + '/.well-known/host-meta' + query
      ];

      return fetchHostMeta(addresses, (options && options.timeout) || 10000).
        then(extractRemoteStorageLink);
    }

    return {
      getStorageInfo: getStorageInfo
    };
});
