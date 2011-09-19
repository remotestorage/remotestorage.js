/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */

$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
if(/([a-f0-9]+).apptorrent.net/.test(location.host)) {
  var appTorrent = JSON.parse(localStorage.getItem(location.host.substring(0,40)))
  if(appTorrent == null) {
    alert('please sign in, let it load, then refresh the page')
    return
  }
} else {
  alert('please use this player on an apptorrent url, e.g. http://dc2f8bddceb7b0f5877031ac5ffebc06241058f.apptorrent.net/unhosted/apptorrent/player/player.html')
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
//document.write(appTorrent.html)

})
