/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */

$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
var appTorrent = JSON.parse(syncStorage.getItem(location.hash.substring(1)))
if(location.hash.length < 2) {
  alert('please specify a hash in the hash, e.g. ')
} else if(appTorrent == null) {
  alert('please sign in first')
}

  //////////////////
 // extract html //
//////////////////
document.write(appTorrent.html)

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

})
