/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */
var makeCssNice = false
var shimSyncStorage = true

$(document).ready(function(){
  ///////////////
 // fetch app //
///////////////
var appTorrent = JSON.parse(syncStorage.getItem(location.hash.substring(1)))

  /////////////////
 // extract css //
/////////////////
var cssFiles = []
for(var fileName in appTorrent.css) {
  cssFiles.push(fileName)
  var textarea= document.createElement('textarea')
  textarea.id = 'css_'+fileName
  textarea.value= ''
  if(makeCssNice) {
    var cssRulesNoClosingAccolade = appTorrent.css[fileName].replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
    for(var i in cssRulesNoClosingAccolade) {
      if(cssRulesNoClosingAccolade[i].length) {
        textarea.value += cssRulesNoClosingAccolade[i] + '}\n'
      }
    }
  } else {
    textarea.value = appTorrent.css[fileName]
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
  if(shimSyncStorage) {
    textarea.value = localToSync(appTorrent.js[fileName])
  } else {
    textarea.value = appTorrent.js[fileName]
  }
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
textarea.value = '<!DOCTYPE html>\n<html>\n<head>\n'
textarea.value += '\t<title>'+appTorrent.title+'</title>\n'
if(shimSyncStorage) {
  textarea.value +='\t<script type="application/javascript" src="../jQuery.js"></script>\n'//shim in syncStorage
  textarea.value +='\t<script type="application/javascript" src="https://browserid.org/include.js"></script>\n'//shim in syncStorage
  textarea.value +='\t<script type="application/javascript" src="../syncStorage4.js"></script>\n'//shim in syncStorage
}
for(var i in cssFiles) {
  textarea.value +='\t<link rel="stylesheet" type="text/css" href="'+cssFiles[i]+'">\n'
}
for(var i in jsFiles) {
  textarea.value +='\t<script type="application/javascript" src="'+jsFiles[i]+'"></script>\n'
}
textarea.value+='</head>\n'+appTorrent.html+'\n</html>\n'
var label= document.createElement('label')
label.innerHTML='<br>index.html:'
document.getElementsByTagName('body')[0].appendChild(label)
document.getElementsByTagName('body')[0].appendChild(textarea)
})
