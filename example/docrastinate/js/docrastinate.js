$(document).ready(function () {
  'use strict';

  // load values and scroll position on start
  $('#calendar').val(localStorage.getItem('calendar'));
  $('#projects').val(localStorage.getItem('projects'));
  $('#personal').val(localStorage.getItem('personal'));
  $('#calendar').scrollTop(localStorage.getItem('scroll-calendar'));
  $('#projects').scrollTop(localStorage.getItem('scroll-projects'));
  $('#personal').scrollTop(localStorage.getItem('scroll-personal'));

  remoteStorage.displayWidget('remotestorage-connect', 'en');
  remoteStorage.loadModule('documents', 'rw');
  var notes = remoteStorage.documents.getPrivateList('notes');
  notes.on('change', function (e) {
    $('#calendar').val(notes.getContent('calendar'));
    $('#projects').val(notes.getContent('projects'));
    $('#personal').val(notes.getContent('personal'));
  });

  $('#calendar').change(function () {
    notes.setContent('calendar', $('#calendar').val());
    localStorage.setItem('scroll-calendar', $('#calendar').scrollTop());
  });
  $('#projects').change(function () {
    notes.setContent('projects', $('#projects').val());
    localStorage.setItem('scroll-projects', $('#projects').scrollTop());
  });
  $('#personal').change(function () {
    notes.setContent('personal', $('#personal').val());
    localStorage.setItem('scroll-personal', $('#personal').scrollTop());
  });
});

$(window).unload(function () { // save values and scroll position on exit
  'use strict';
  notes.setContent('calendar', $('#calendar').val());
  notes.setContent('projects', $('#projects').val());
  notes.setContent('personal', $('#personal').val());
  localStorage.setItem('scroll-calendar', $('#calendar').scrollTop());
  localStorage.setItem('scroll-projects', $('#projects').scrollTop());
  localStorage.setItem('scroll-personal', $('#personal').scrollTop());
});
