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

    var timeout = 10000;

      ///////////////
     // Webfinger //
    ///////////////

    // PARSE

    // parse user address
    function extractHostname(userAddress) {
      var parts = userAddress.toLowerCase().split('@');
      var error;
      if(parts.length < 2) {
        error = 'no-at';
      } else if(parts.length > 2) {
        error = 'multiple-at';
      } else {
        if(!(/^[\.0-9a-z\-\_]+$/.test(parts[0]))) {
          error = 'non-dotalphanum';
        } else if(!(/^[\.0-9a-z\-]+$/.test(parts[1]))) {
          error = 'non-dotalphanum';
        }
      }
      if(error) {
        throw error;
      }
      return parts[1];
    }

    function parseXRD(str) {
      return util.getPromise(function(promise) {
        platform.parseXml(str, function(err, obj) {
          if(err) {
            promise.reject(err);
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
              promise.reject('invalid-xml');
            }
          }
        });
      });
    }

    function parseJRD(data) {
      var object = JSON.parse(data);
      if(! object.links) {
        throw 'invalid-jrd';
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
    function fetchProfile(address) {
      logger.info('fetch profile', address);
      return platform.ajax({
        url: address,
        timeout: timeout
      }).then(function(body, headers) {
        var mimeType = headers && headers['content-type'] && headers['content-type'].split(';')[0];
        logger.debug('fetched', body, mimeType);
        if(mimeType && mimeType.match(/^application\/json/)) {
          return parseJRD(body);
        } else {
          return util.getPromise(function(jrdPromise) {
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
    function fetchHostMeta(protocol, addresses) {
      addresses = addresses.map(function(addr) {
        return protocol + addr;
      });
      return util.asyncMap(addresses, fetchProfile).
        then(function(profiles, errors) {
          logger.debug('host meta mapped', profiles);
          for(var i=0;i<profiles.length;i++) {
            if(profiles[i]) {
              return profiles[i];
            }
          }
          // if any of the requests failed due to a timeout, that's our
          // reason as well.
          for(var j=0;j<errors.length;j++) {
            if(errors[j] === 'timeout') {
              throw "timeout";
            }
          }
          // otherwise we just fail with a generic reason.
          throw 'requests-failed';
        });
    }

    function extractRemoteStorageLink(links) {
      logger.debug('extract remoteStorage link', links);
      var remoteStorageLink = links.remoteStorage || links.remotestorage;
      var lrddLink;
      if(remoteStorageLink) {
        logger.info('remoteStorageLink', remoteStorageLink);
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
      } else if((lrddLink = links.lrdd) && links.lrdd.template) {
        return fetchProfile(
          lrddLink.template.replace('{uri}', 'acct:' + userAddress)
        ).then(extractRemoteStorageLink);
      } else {
        throw 'not-supported';
      }
    }

    // method: getStorageInfo
    // Get the storage information of a given user address.
    //
    // Parameters:
    //   userAddress - a string in the form user@host
    //
    // Callback parameters:
    //   err         - either an error message or null if discovery succeeded
    //   storageInfo - the format is equivalent to that of the JSON representation of the remotestorage link (see above)
    //
    // Returns:
    //   A promise for the user's webfinger profile
    //
    function getStorageInfo(userAddress) {

      /*

        - validate userAddres
        - fetch host-meta
        - parse host-meta
        - (optionally) fetch lrdd
        - (optionally) parse lrdd
        - extract links

       */

      return util.getPromise(function(promise) {
        try {
          var hostname = extractHostname(userAddress)
        } catch(error) {
          if(error) {
            return promise.reject(error);
          }
        }
        var query = '?resource=' + encodeURIComponent('acct:' + userAddress);
        var addresses = [
          '://' + hostname + '/.well-known/webfinger' + query,
          '://' + hostname + '/.well-known/host-meta.json' + query,
          '://' + hostname + '/.well-known/host-meta' + query,
        ];

        fetchHostMeta('https', addresses).
          then(extractRemoteStorageLink, function() {
            return fetchHostMeta('http', addresses).
              then(extractRemoteStorageLink);
          }).
          then(function(profile) {
            promise.fulfill(profile);
          }, promise.reject);
      });
    }

    return {
      getStorageInfo: getStorageInfo,

      setTimeout: function(t) {
        timeout = t;
      },

      getTimeout: function() {
        return timeout;
      }
    };
});
