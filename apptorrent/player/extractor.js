/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
var appTorrent = JSON.parse(syncStorage.getItem('629fec71f7c33bd2c50fed369d1ff8e677012774'))


  //////////////////
 // extract html //
//////////////////
var input= document.createElement('input')
input.type= 'text'
input.id = 'html'
input.value = appTorrent.html
document.getElementsByTagName('body')[0].appendChild(input)


  /////////////////
 // extract css //
/////////////////
for(var fileName in appTorrent.css) {
  var input= document.createElement('input')
  input.type= 'text'
  input.id = 'css_'+fileName
  input.value= ''
  var cssRulesNoClosingAccolade = appTorrent.css[fileName].replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
  for(var i in cssRulesNoClosingAccolade) {
    if(cssRulesNoClosingAccolade[i].length) {
      input.value += cssRulesNoClosingAccolade[i] + '}\n'
    }
  }
  document.getElementsByTagName('body')[0].appendChild(input)
}

for(var fileName in appTorrent.js) {
  var input= document.createElement('input')
  input.type= 'text'
  input.id = 'js_'+fileName
  input.value = appTorrent.js[fileName]
    .replace(new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.([\ ]+)=([\ ]+)([A-Za-z0-9\.\(\)]+)','g'), 'localStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)([\ ]+)=([\ ]+)([A-Za-z0-9\.]+)','g'), 'localStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.','g'), 'localStorage.getItem(\'$2\')')
    .replace(new RegExp('localStorage\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)','g'), 'localStorage.getItem(\'$1\')')
    .replace('localStorage', 'syncStorage')
  document.getElementsByTagName('body')[0].appendChild(input);
}
})
