/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */

$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
if(/([a-f0-9]+).apptorrent/.test(location.host)) {
  var appTorrent = JSON.parse(localStorage.getItem(location.host.substring(0,40)))
  if(!appTorrent) {
    if(gup('peer') == null) {
      alert('please specify a peer to retrieve this app from')
      return
    } else{
      $.ajax(
         { url: 'http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'
            +location.host.substring(0,40)
        , success: function(data) {
          localStorage.setItem(location.host.substring(0,40), data)
          }
        })
    }
  }
} else {
  alert('please use this player on a <hash>.apptorrent.something url, e.g. http://dc2f8bddceb7b0f5877031ac5ffebc06241058f.apptorrent.net/unhosted/apptorrent/player/player.html')
  return
}

  /////////////////
 // extract css //
/////////////////
for(var fileName in appTorrent.css) {
  var cssRulesNoClosingAccolade = appTorrent.css[fileName].replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
  for(var i in cssRulesNoClosingAccolade) {
    if(cssRulesNoClosingAccolade[i].length) {
      document.getElementsByTagName('style')[0].sheet.insertRule(cssRulesNoClosingAccolade[i] + '}', i)
    }
  }
}

  ////////////////
 // extract js //
////////////////
for(var fileName in appTorrent.js) {
   var script= document.createElement('script')
   script.type= 'text/javascript'
   script.id= fileName
   script.innerHTML = localToSync(appTorrent.js[fileName])
   document.getElementsByTagName('head')[0].appendChild(script)
}

  //////////////////
 // extract html //
//////////////////
document.body.innerHTML = appTorrent.html

})
