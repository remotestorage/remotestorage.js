var scripts = document.getElementsByTagName('script');
var locator = (new Function('return ' + scripts[scripts.length - 1].innerHTML.replace(/\n|\r/g, '')))();
alert('loading '+JSON.stringify(locator)+' (under construction)')
