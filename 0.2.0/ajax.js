//implementing $.ajax() like a poor man's jQuery:

      //////////
     // ajax //
    //////////

define({
  ajax: function(params) {
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
        if(xhr.status == 200 || xhr.status == 201 || xhr.status == 204) {
          params.success(null, xhr.responseText);
        } else {
          params.error(xhr.status, 'Got status code '+xhr.status);
        }
      }
    }
    xhr.send(params.data);
  }
});
