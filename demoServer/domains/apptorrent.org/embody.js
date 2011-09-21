  /* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
(function() {
  //implementing $(document).ready(embody):
  document.addEventListener('DOMContentLoaded', function() {
    document.removeEventListener('DOMContentLoaded', arguments.callee, false );
    embody()
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
 
  function embody() {
    function findLocator() {
      var scripts = document.getElementsByTagName('script');
       return (new Function('return ' + scripts[scripts.length - 1].innerHTML.replace(/\n|\r/g, '')))();
    }
    function fetchApp(cb) {
      //var hash ='7996ff45cf4d140398d729accc6c6c0a6b66fb89'
      var hash = findLocator().url.replace('apptorrent://mich@yourremotestorage.com/', '')
      if(localStorage.getItem(hash)) {
        cb(JSON.parse(localStorage.getItem(hash)))
      } else {
        ajax(
        { url: 'http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'+hash
        , success: function(data) {
            localStorage.setItem(hash, data)
            cb(JSON.parse(data))
          }
        })
      }
    }
    function embodyCss(css) {
      for(var fileName in css) {
        var style= document.createElement('style')
        document.getElementsByTagName('head')[0].appendChild(style)
        var cssRulesNoClosingAccolade = css[fileName].replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
        for(var i in cssRulesNoClosingAccolade) {
          if(cssRulesNoClosingAccolade[i].length) {
            //console.log(fileName+'('+i+'): '+cssRulesNoClosingAccolade[i]+'}')
            if((fileName != 'css/uncompressed/general.css')) {
              style.sheet.insertRule(cssRulesNoClosingAccolade[i] + '}', i)
    }
        }
        }
      }
    }
    function embodyJs(js) {
      for(var fileName in js) {
        var script= document.createElement('script')
        script.type= 'text/javascript'
        script.id= fileName
        //script.innerHTML = localToSync(js[fileName])
        script.innerHTML = js[fileName]
        document.getElementsByTagName('head')[0].appendChild(script)
       }
    }
    function embodyHtml(html) {
      document.body.innerHTML = html
    }
    fetchApp(function(app) {
      embodyCss(app.css)
      embodyJs(app.js)
      embodyHtml(app.html)
    })
  }
})()
