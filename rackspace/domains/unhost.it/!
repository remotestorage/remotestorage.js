(function() {
  //scrape the current page into a sausage (under construction):
  var sausage =
    { body: document.body.innerHTML
    , autoexec: 'document.write(apptorrent.body)'
    }
       //document.write(\'<script>document.body.innerHTML=apptorrent.body;</'+'script>\')'

  //calculate the sha1 of the sausage (under construction):
  var hash='7996ff45cf4d140398d729accc6c6c0a6b66fb89'

  //store it on your remoteStorage (hardcoded to mich@yourremotestorage.com for now):
  var url= 'http://yourremotestorage.com/apps/unhosted/compat.php/mich/unhosted/webdav/yourremotestorage.com/mich/apptorrent/'+hash
  var x = new XMLHttpRequest()
  x.open('PUT', url, true)
  x.setRequestHeader('Authorization', 'Basic bWljaEB5b3VycmVtb3Rlc3RvcmFnZS5jb206NGU3N2E0NDUyMGRkOA==')
  x.send(JSON.stringify(sausage))
  x.onreadystatechange = function() {
    if(x.readyState == 4) {
      if((x.status == 200) || (x.status == 201)) {

        //leave current document and enter empty-host origin:
        document.write('<script>'
          + 'document.write(\'<a id="resetMyScriptParent" href="'
          +'javascript:\\\'<script>'
            + '(function(){'
            + escape

              //add a link to the sausage we just unhosted:
              ( 'localStorage.setItem(\\\'7996ff45cf4d140398d729accc6c6c0a6b66fb89\\\',\\\''+url+'\\\');'

              //display the links view:
              + 'location=\\\'javascript:'
              + escape
                ( '\'<script>'
                  + 'document.write(\\\'These are your apptorrent apps:<br>\\\');'
                  + 'for(var i=0;i<localStorage.length;i++){'
                    + 'var key=localStorage.key(i);'
                    + 'document.write(\\\'<a href="'

                      //use a wildcard subdomain as the runtime origin for the unhosted app:
                      + 'http://\\\'+key+\\\'.apptorrent.net/#!/(function(){'

                        //fetch and install (todo: skip this if already installed):
                        + 'var x=new XMLHttpRequest();'
                        + 'x.open(\\\\\\\'GET\\\\\\\',\\\\\\\'\\\'+localStorage.getItem(key)+\\\'\\\\\\\',false);'
                        + 'x.send();'
                        + 'localStorage.setItem(\\\\\\\'apptorrent\\\\\\\',x.responseText);'

                        //push apptorrent player url onton history and play:
                        + 'location=\\\\\\\'#!/(function(){'
                          + 'window.apptorrent=JSON.parse(localStorage.getItem(\\\\\\\\\\\\\\\'apptorrent\\\\\\\\\\\\\\\'));'
                          + 'eval(apptorrent.autoexec);'
                        + '})()\\\\\\\';'
                        + 'eval(location.hash.substring(3));'
                      + '})()'
                      + '">\\\'+key+\\\'</a><br>\\\')'
                  + '}'
                + '</\'+\'script>'
                + '\''
                )
              + '\\\';'
            )
            + '})()'
          + '</\\\'+\\\'script>\\\''
          + '"></a>\');'
          + 'document.getElementById(\'resetMyScriptParent\').click()'
          + '</script>')
      }
    }
  }
})()
