

* pick an html5 app
* take the html body, remove newlines and tabs. escape single quotes. put it into the html field of the appTorrent json object
* take the js code, uglify it, escape single quotes. also escape '\' to '\\'. put it into the js field of the appTorrent json object
* take the css, put one CssRule per line, remove comments, escape single quotes. Prepend "    , '" and append "'" to each line. Add into apptorrent object.
