/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
(function() {
  function findLocator() {
    var hash ='7996ff45cf4d140398d729accc6c6c0a6b66fb89'
    return (
      { hash: hash
      , locator: 'apptorrent://mich@yourremotestorage.com/'+hash
      , seeds: ['http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'+hash]
      })
  }
  function fetchApp(cb) {
    var hash = findLocator().locator.replace('apptorrent://mich@yourremotestorage.com/', '')
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
      var cssRulesNoClosingAccolade = css[fileName]
        .replace(/[\r\n]/g, '')
        .split('}')
      var j=0
      for(var i in cssRulesNoClosingAccolade) {
        if(cssRulesNoClosingAccolade[i].length) {
          var rule = (cssRulesNoClosingAccolade[i]+'}')
            .replace('/* ** ** custom select color ** ** */::selection { background:#525252; /* Safari */ }', '')
          style.sheet.insertRule(rule, style.sheet.cssRules.length)
        }
      }
    }
  }
  function localToSync(str) {
    return str
      .replace(new RegExp('localStorage\\\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)([\ ]+)=([\ ]+)([A-Za-z0-9\.]+)','g'), 'remoteStorage.setItem(\'$1\', $4)')
      .replace(new RegExp('localStorage\\\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)','g'), 'remoteStorage.getItem(\'$1\')')
      .replace(new RegExp('localStorage\\\[\\\'([A-Za-z0-9\.]+)\\\'\\\]([\ ]+)=([\ ]+)([A-Za-z0-9\.\(\)]+)','g'), 'remoteStorage.setItem(\'$1\', $4)')
      .replace(new RegExp('localStorage\\\[\\\'([A-Za-z0-9\.]+)\\\'\\\]','g'), 'remoteStorage.getItem(\'$1\')')
      .replace('localStorage\.getItem', 'remoteStorage.getItem')
      .replace('localStorage\.setItem', 'remoteStorage.setItem')
      .replace('localStorage\.length', 'remoteStorage.length')
      .replace('localStorage\.key', 'remoteStorage.key')
      .replace('localStorage\.clear', 'remoteStorage.clear')
  }
  function embodyJs(js) {
    for(var fileName in js) {
      var script= document.createElement('script')
      script.type= 'text/javascript'
      script.id= fileName
      script.innerHTML = localToSync(js[fileName])
      document.getElementsByTagName('head')[0].appendChild(script)
     }
  }
  function embodyHtml(html) {
    document.body.innerHTML = html
  }
  window.embody = function() {
    fetchApp(function(app) {
      embodyCss(app.css)
      embodyJs(app.js)
      embodyHtml(app.html)
    })
  }
})()
