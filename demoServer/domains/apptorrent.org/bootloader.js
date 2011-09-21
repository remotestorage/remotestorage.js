/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */

$(document).ready(function(){
var hash ='7996ff45cf4d140398d729accc6c6c0a6b66fb89'
      $.ajax(
         { url: 'http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'
            +hash
        , success: function(data) {
          localStorage.setItem(location.host.substring(0,40), data)
          }
        })

  var appTorrent = JSON.parse(localStorage.getItem(hash))
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
