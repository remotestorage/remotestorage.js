
/*
Copyright 2012 Jan-Christoph Borchardt

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/
function $(id){
    return document.getElementById(id)
}

remoteStorage.loadModule('documents', '0.1', 'rw')
remoteStorage.displayWidget('rs-widget');
var notes = remoteStorage.documents.getPrivateList('notes')
notes.on('change', function(e) {
  updateList()
  formatting()
});


function show() {
    if (notes.getIds().indexOf(id) != -1) {
      $('editor').innerHTML = notes.getContent(id)
    }
}

function select() {
    document.createRange().setStart($('editor'), 0)
    getSelection().removeAllRanges()
    getSelection().addRange(document.createRange())
}

function create() {
    $('editor').textContent = ''
    id = notes.add('')
    location.hash = '#'+ id
    select()
    updateList()
}

function updateList() {
    var ids = notes.getIds()
    var r = []
    for (var i=0; i<ids.length; i++) {
        var item = notes.getTitle(ids[i])
        if (item) {
            r.push('<a id="item_'+ ids[i] +'" href="#'+ids[i]+'">'+ item.slice(0, 50) +'</a>')
        }
    }

    $('entries').innerHTML = r.join('')
    highlightSelected()
}

function check() {
    var hash = location.hash
    if (hash) {
        id = hash.slice(1)
        show()
    } else {
        create()
    }
    updateList()
    select()
}

function setTitle(str) {
    if (str.length >= 30) {
        var i = str.lastIndexOf(" ") + 1
        if (i)
            str = str.slice(0, i)
        str += '...'
    }
    document.title = str
}

function highlightSelected(){
    var hash = location.hash.slice(1)
    if (!hash) return
    var element = $('item_'+hash)
    if (element) {
        element.className += ' selected'
        setTitle(element.textContent)
    }
}

function colorToggle(){
  var body = document.getElementsByTagName('body')[0];
  if(body.className == 'dark') body.className = '';
  else body.className = 'dark';
}

function formatting(){ // this needs to get incredibly optimized â€¦
  for(i=0; i<$('editor').getElementsByTagName('div').length; i++) {
    // bullet points, deactivated for now /*
    /*if(($('editor').getElementsByTagName('div')[i].innerHTML.substring(0, 2) == '* ') || ($('editor').getElementsByTagName('div')[i].innerHTML.substring(0, 2) == 'â€¢ ')) {
      $('editor').getElementsByTagName('div')[i].className = 'listelement';
      if($('editor').getElementsByTagName('div')[i].innerHTML.substring(0, 2) == '* ') {
        $('editor').getElementsByTagName('div')[i].innerHTML = 'â€¢' + $('editor').getElementsByTagName('div')[i].innerHTML.substring(1);
      }
    }
    // headings
    else */if($('editor').getElementsByTagName('div')[i].innerHTML.substring(0, 1) == '#') {
      $('editor').getElementsByTagName('div')[i].className = 'subheading';
    }
    else {
      $('editor').getElementsByTagName('div')[i].className = '';
    }
  }
}


$('editor').onkeyup = $('editor').onpaste = function(e){
    var html = e.target.innerHTML
    if (html != notes.getContent(id)) {
        notes.setContent(id, e.target.textContent)
        updateList()
    }
    formatting();
}

onload=onhashchange=check

