//implementing $.ajax() like a poor man's jQuery:

      //////////
     // ajax //
    //////////

exports.ajax = function(params) {
  var xhr = new XMLHttpRequest();
  if(!params.method) {
    params.method='GET';
  }
  if(!params.data) {
    params.data = null;
  }
  xhr.open(params.method, params.url, true);
  if(params.headers) {
    for(var header in params.headers) {
      xhr.setRequestHeader(header, params.headers[header]);
    }
  }
  xhr.onreadystatechange = function() {
    if(xhr.readyState == 4) {
      if(xhr.status == 0) {
        //alert('looks like '+params.url+' has no CORS headers on it! try copying this scraper and that file both onto your localhost')
        params.error(xhr);
      } else {
        params.success(xhr.responseText);
      }
    }
  }
  xhr.send(params.data);
}
