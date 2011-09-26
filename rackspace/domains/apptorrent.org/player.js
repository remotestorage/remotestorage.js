
  //avoid using jQuery so that this code stays small in case we want to
  //put it into a bookmarklet some time
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
  function el(id) {
    return document.getElementById(id)
  }

function getLocator() {
  var hash = window.location.href.substring(7, 47)
  return (
    { hash: hash
    , seeds: ['http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'+hash]
    })
}
function getApp(cb) {
  var locator = getLocator()
  if(localStorage.getItem('apptorrent')) {
    cb(localStorage.getItem('apptorrent'))
  } else {
    ajax(
     { url: locator.seeds[0]
     , success: function(data) {
         localStorage.setItem('apptorrent', data)
         cb(data)
       }
     })
  }
}

getApp(function(data) {alert(JSON.stringify(data))})
