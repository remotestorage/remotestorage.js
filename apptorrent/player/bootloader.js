/* bootloader.js for appTorrent player. AGPL-licensed by the Unhosted project */

  ///////////////
 // fetch app //
///////////////
var appTorrent = JSON.parse(syncStorage.getItem('a80bbb1b6496bba00681cc01eff3a7dbba840bed'))


  //////////////////
 // extract html //
//////////////////
document.write(appTorrent.html)


  /////////////////
 // extract css //
/////////////////
var cssRulesNoClosingAccolade = appTorrent.css.replace(new RegExp( '[\\n\\r]', 'g' ), '').split('}')
for(var i in cssRulesNoClosingAccolade) {
  if(cssRulesNoClosingAccolade[i].length) {
    document.getElementsByTagName('style')[0].sheet.insertRule(cssRulesNoClosingAccolade[i] + '}', i)
  }
}


  ///////////////////////////////////////////
 // replace localStorage with syncStorage //
///////////////////////////////////////////

//deal with lines like: localStorage['events'] = JSON.stringify(this.EVENTS);
appTorrent.js = appTorrent.js.replace(
  new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.([\ ]+)=([\ ]+)([A-Za-z0-9\.\(\)]+)','g')
  , 'localStorage.setItem(\'$1\', $4)')

//deal with lines like: localStorage.setup = 1
appTorrent.js = appTorrent.js.replace(
  new RegExp('localStorage\.'
    +'(?!setItem)(?!getItem)(?!clear)(?!length)'
    +'([A-Za-z0-9\.]+)([\ ]+)=([\ ]+)([A-Za-z0-9\.]+)','g')
  , 'localStorage.setItem(\'$1\', $4)')

//deal with lines like: this.EVENTS = localStorage['events']
appTorrent.js = appTorrent.js.replace(
  new RegExp('localStorage.\'([A-Za-z0-9\.]+)\'.','g')
  , 'localStorage.getItem(\'$2\')')

//deal with lines like: if(localStorage.setup) {
appTorrent.js = appTorrent.js.replace(
  new RegExp('localStorage\.'
    +'(?!setItem)(?!getItem)(?!clear)(?!length)'
    +'([A-Za-z0-9\.]+)','g')
  , 'localStorage.getItem(\'$1\')')
appTorrent.js = appTorrent.js.replace('localStorage', 'syncStorage')


  ////////////////
 // extract js //
////////////////

//instead of just eval-ling, put script into DOM so we can inspect the code easily in bugzilla
   var script= document.createElement('script');
   script.type= 'text/javascript';
   script.innerHTML = appTorrent.js;
   document.getElementsByTagName('head')[0].appendChild(script);
