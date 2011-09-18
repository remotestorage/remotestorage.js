/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
var appTorrent = JSON.parse(syncStorage.getItem('629fec71f7c33bd2c50fed369d1ff8e677012774'))

  /////////////////
 // extract css //
/////////////////
var cssFiles = []
for(var fileName in appTorrent.css) {
  cssFiles.push(fileName)
  var textarea= document.createElement('textarea')
  textarea.id = 'css_'+fileName
  textarea.value= ''
  var cssRulesNoClosingAccolade = appTorrent.css[fileName].replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
  for(var i in cssRulesNoClosingAccolade) {
    if(cssRulesNoClosingAccolade[i].length) {
      textarea.value += cssRulesNoClosingAccolade[i] + '}\n'
    }
  }
  var label= document.createElement('label')
  label.innerHTML='<br>'+fileName+':'
  document.getElementsByTagName('body')[0].appendChild(label)
  document.getElementsByTagName('body')[0].appendChild(textarea)
}

  ////////////////
 // extract js //
////////////////
var jsFiles = []
for(var fileName in appTorrent.js) {
  jsFiles.push(fileName)
  var textarea= document.createElement('textarea')
  textarea.id = 'js_'+fileName
  textarea.value = appTorrent.js[fileName]
    .replace(new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.([\ ]+)=([\ ]+)([A-Za-z0-9\.\(\)]+)','g'), 'localStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)([\ ]+)=([\ ]+)([A-Za-z0-9\.]+)','g'), 'localStorage.setItem(\'$1\', $4)')
    .replace(new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.','g'), 'localStorage.getItem(\'$2\')')
    .replace(new RegExp('localStorage\.(?!setItem)(?!getItem)(?!clear)(?!length)([A-Za-z0-9\.]+)','g'), 'localStorage.getItem(\'$1\')')
    .replace('localStorage', 'syncStorage')
  var label= document.createElement('label')
  label.innerHTML='<br>'+fileName+':'
  document.getElementsByTagName('body')[0].appendChild(label)
  document.getElementsByTagName('body')[0].appendChild(textarea);
}

  //////////////////
 // extract html //
//////////////////
var textarea= document.createElement('textarea')
textarea.id = 'html'
textarea.value = '<html><head>\n'
for(var i in cssFiles) {
  textarea.value +='<link rel="stylesheet" type="text/css" href="'+cssFiles[i]+'">\n'
}
for(var i in jsFiles) {
  textarea.value +='<script type="application/javscript" src="'+jsFiles[i]+'"></script>\n'
}
textarea.value+='<head>\n'+appTorrent.html+'\n</html>\n'
var label= document.createElement('label')
label.innerHTML='<br>index.html:'
document.getElementsByTagName('body')[0].appendChild(label)
document.getElementsByTagName('body')[0].appendChild(textarea)
})
