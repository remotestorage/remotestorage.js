define(
  ['./platform'],
  function (platform) {
    function doCall(method, url, value, token, cb, deadLine) {
      var platformObj = {
        url: url,
        method: method,
        error: function(err) {
          cb(err);
        },
        success: function(data) {
          cb(null, data);
        },
        timeout: 3000
      }

      platformObj.headers = {
        'Authorization': 'Bearer ' + decodeURIComponent(token),
        'Content-Type':  'text/plain;charset=UTF-8'
      };

      platformObj.fields = {withCredentials: 'true'};
      if(method != 'GET') {
        platformObj.data =value;
      }

      platform.ajax(platformObj);
    }

    function get(url, token, cb) {
      if(url.substr(-1) == '/') {
        doCall('PROPFIND', url, null, token, function(err, data) {
          if(err == null) {
            //<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">
            //  <d:response>
            //    <d:href>/apps/remoteStorage/WebDAV.php/admin/remoteStorage/test/foo/bar/</d:href>
            //    <d:propstat>
            //      <d:prop>
            //        <d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">
            //          Tue, 05 Jun 2012 15:48:54 GMT
            //        </d:getlastmodified>
            //        <d:resourcetype>
            //          <d:collection/>
            //        </d:resourcetype>
            //        <d:quota-used-bytes>4105</d:quota-used-bytes>
            //        <d:quota-available-bytes>8516481024</d:quota-available-bytes>
            //      </d:prop>
            //      <d:status>HTTP/1.1 200 OK</d:status>
            //    </d:propstat>
            //  </d:response>
            //  <d:response>
            //    <d:href>/apps/remoteStorage/WebDAV.php/admin/remoteStorage/test/foo/bar/baz</d:href>
            //    <d:propstat>
            //      <d:prop>
            //        <d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">
            //          Tue, 05 Jun 2012 16:05:56 GMT
            //        </d:getlastmodified>
            //        <d:getcontentlength>2</d:getcontentlength>
            //        <d:resourcetype/>
            //        <d:getcontenttype>text/plain</d:getcontenttype>
            //      </d:prop>
            //      <d:status>HTTP/1.1 200 OK</d:status>
            //    </d:propstat>
            //  </d:response>
            //</d:multistatus>

            platform.parseXml(data, function(obj) {
              cb(null, obj);
            });
          } else {
            cb(err);
          }
        });
      } else {
        doCall('GET', url, null, token, function(err, data) {
          if(err == 404) {
            cb(null, undefined);
          } else {
            cb(err, data);
          }
        });
      }
    }

    function put(url, value, token, cb) {
      doPut(url, value, token, 0, cb);
    }
    function doPut(url, value, token, mkcolLevel, cb) {
      if(mkcolLevel==0) {
        doCall('PUT', url, value, token, function(err, data) {
          if(err == 404) {
            doPut(url, value, token, 1, cb);
          } else {
            cb(err, data);
          }
        });
      } else {
        var urlParts = url.split('/');
        if(urlParts.length<mkcolLevel+3) {
          cb('put failed, looks like server is not compliant (reached root in MKCOL chain)');
        } else {
          doCall('MKCOL', urlParts.slice(0, urlParts.length - mkcolLevel).join('/'), null, token, function(err) {
            if(err==404 || err==409) {
              doPut(url, value, token, mkcolLevel+1, cb);
            } else if(err) {
              cb(err);
            } else {
              doPut(url, value, token, mkcolLevel-1, cb);
            }
          });
        }
      }
    }

    function set(url, valueStr, token, cb) {
      if(typeof(valueStr) == 'undefined') {
        doCall('DELETE', url, null, token, cb);
      } else {
        put(url, valueStr, token, cb);
      }
    }

    return {
      get:    get,
      set:    set
    }
});
