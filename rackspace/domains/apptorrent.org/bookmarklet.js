/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
(function() {
  require('http://apptorrent.org/jQuery.js')
  require('http://apptorrent.org/remoteStorage.js')
  require('http://apptorrent.org/mfs.js')

  //implementing $(document).ready(embody):
  document.addEventListener('DOMContentLoaded', function() {
    document.removeEventListener('DOMContentLoaded', arguments.callee, false );
    window.embody()
  }, false)
  //implementing $.ajax():
  function ajax(params) {
    var xhr = new XMLHttpRequest()
    if(!params.method) {
      params.method='GET'
    }
    if(!params.data) {
      params.data = null
    }
    xhr.open(params.method, params.url, true)
    if(params.headers) {
      for(var header in params.headers) {
        xhr.setRequestHeader(header, params.headers[header])
      }
    }
    xhr.onreadystatechange = function() {
      if(xhr.readyState == 4) {
        if(xhr.status == 0) {
          alert('looks like '+params.url+' has no CORS headers on it! try copying this scraper and that file both onto your localhost')
        }
        params.success(xhr.responseText)
      }
    }
    xhr.send(params.data)
  }
  function require(url) {
    ajax(
      { url: url
      , success: function(data) {
          eval(data)
        }
      })
  }
})()
