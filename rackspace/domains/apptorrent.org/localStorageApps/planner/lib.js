/*
		Simple Planner
		A localStorage based personal planner prototype
		Made for 10K Apart
		
		Kailash Nadh, http://kailashnadh.name	(August 2011)
*/
var Planner = {
	DAYS: ['Mon','Tue','Wed','Thu','Fri','Sat', 'Sun'],
	MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'],
	LABELS: ['todo', 'personal', 'work', 'important', 'misc'],
	Date: new Date(),
	UI: null,
	EVENTS: {},
	diary_open: false,
	
	init: function() {
		this.EVENTS = localStorage['events'];
		if(!this.EVENTS) {
			this.EVENTS = {};
			if(!localStorage.setup) {
				// initial setup
				var holidays = {'1-0': 'New Year', '8-2': 'Commonwealth Day', '17-2': 'St. Patrick\'s Day', '1-3': 'April fools', '22-3': 'Earth Day', '1-4': 'May Day', '5-4': 'Cinco de Mayo', '4-6': 'Independence Day (US)', '3-7': 'Friendship Day', '10-7': 'Rollercoaster Day', '17-8': 'International Day of Peace', '16-9': 'World Food Day', '31-9': 'Halloween', '4-10': 'Diwali', '17-10': 'World Peace Day', '22-10': 'Thanksgiving', '25-11': 'Christmas'};

				for(var year=this.Date.getFullYear(); year<=this.Date.getFullYear()+1; year++) {
					for(var id in holidays) {
						this.createEvent(
							id + '-' + year,
							'00',
							'00',
							holidays[id],
							'misc'
						);
					}
				}
				
				// random entries
				for(var i=0; i<7; i++) {
					this.createEvent(
						Math.floor(Math.random()*28) + '-'+ this.Date.getMonth() + '-'+ this.Date.getFullYear(),
						Math.floor(Math.random()*23).pad(2),
						'00',
						'This is a dummy event. The number ' + i + ' is cool!',
						this.LABELS[Math.floor(Math.random()*(this.LABELS.length-1))]
					);
				}
				localStorage.setup = 1;
			}
		} else {
			try{
				this.EVENTS = JSON.parse(this.EVENTS);
			} catch(e) {
				localStorage.clear();
				this.EVENTS = {};
			}
		}

		this.phone = navigator.userAgent.match(/phone/i) || navigator.userAgent.match(/android/i);
		
		this.setDate();
		this.initUI();
		
		// what month to render first?
		var hash = document.location.href.match(/([0-9]{1,2})\-([0-9]{4})/i);
		if(hash && hash[1] >= 1 && hash[1] <= 12 && hash[2] >= 1900 && hash[2] <= 2050) {
			this.specificMonth(hash[1], hash[2]);
		} else {
			this.today();
		}
		
		// only load the diary on pageload if there's enough space to render it
		Planner.renderDiary( $('.day' + this.date).data('id') );
		this.UI.resize();

		Planner.UI.diary_wrap.show();
		var covered = (Planner.UI.diary_wrap.offset().left - Planner.UI.calendar_wrap.innerWidth());
		Planner.UI.diary_wrap.hide();
		if(!this.phone && covered > -35 && new Date().getMonth() == this.month ) {
			Planner.showDiary();
		}
	},
	initUI: function() {
		this.UI = {
			themes: ['dark', 'light'],
			'calendar': $('#calendar'),
			'dialog': $('#dialog'),
			'add': $('#add'),
			'calendar_wrap': $('#calendar-wrap'),
			'diary_wrap': $('#diary-wrap'),
			'event_label': $('#event-label'),
			'event_hour': $('#event-hour'),
			'event_minute': $('#event-minute'),
			'event_description': $('#event-description'),
			'event_delete': $('#event-delete'),
			'event_tweet': $('#event-tweet'),
			'diary': $('#diary')
		};
		
		// time in create event dialog
		var val = '';
		for(i=0; i<24; i++) {
			val = i.pad(2);
			this.UI.event_hour.append( $('<option value="'+val+'">').html(val) );
		}
		for(i=0; i<60; i+=15) {
			val = i.pad(2);
			val = val.substr(val.length-2);
			this.UI.event_minute.append( $('<option value="'+val+'">').html(val) );
		}
		
		// label colors in create event dialog
		var labels = $('<div class="labels">'), lbl = '';
		for(var i in this.LABELS) {
			lbl = this.LABELS[i];
			labels.append( $('<label class="'+lbl+' label" for="label-'+lbl+'">'+lbl+' <input type="radio" name="event-label" value="'+lbl+'" id="label-'+lbl+'" class="'+ lbl +'"></label>') );
		}
		this.UI.event_label.append(labels);
		
		// day names
		var html = '';
		for(var i=0; i<7; i++) {
			html += '<td>'+this.DAYS[i]+'</td>';
		}
		$('thead').append( $('<tr>').html(html) );
		
		// close add prompt
		$('#event-close').click(function() {
			Planner.closeAddPrompt();
		});
		$('#dialog-close').click(function() {
			Planner.closeDialog();
			return false;
		});
		$(document).keyup(function(e) {
			if(e.altKey) return;

			if (e.keyCode == 27) {
				Planner.closeAddPrompt();
			} else if (e.keyCode == 37) {
				Planner.previousMonth();
			} else if (e.keyCode == 39) {
				Planner.nextMonth();
			} else if (e.keyCode == 38 || e.keyCode == 40) {
				Planner.today();
			}
		});

		
		// event form add
		this.UI.add.submit(function() {
			Planner.createEvent(
				Planner.new_id,
				Planner.UI.event_hour.val(),
				Planner.UI.event_minute.val(),
				Planner.UI.event_description.val().replace(/<\/?(?!\!)[^>]*>/gi, ''),
				Planner.UI.event_label.find('input[name="event-label"]:checked').val(),
				Planner.event_i
			);
			Planner.closeAddPrompt();
			Planner.renderEvents();
			if(Planner.diary_open) {
				Planner.renderDiary(Planner.new_id);
			}
			return false;
		});
		
		this.UI.event_delete.click(function() {
			var id = $(this).data('id');
			Planner.deleteEvent( id, $(this).data('i') );
			Planner.closeDialog();
			Planner.renderCalendar();
			Planner.renderDiary(id);
			return false;
		});
		
		this.UI.event_tweet.click(function() {
			var id = $(this).data('id');
			var tweet = Planner.EVENTS[id][$(this).data('i')];
			
			window.open('http://twitter.com/home?status=' + escape(tweet.description + ' @ ' + tweet.hour + ':' + tweet.minute + ', ' + Planner.dateStringID(id)) );
			return false;
		});
		
		// previous and next buttons
		$('#btn-previous').click(function() {
			Planner.previousMonth();
			return false;
		});
		$('#btn-next').click(function() {
			Planner.nextMonth();
			return false;
		});
		$('#btn-today').click(function() {
			Planner.today();
			return false;
		});

		// theme
		$('#btn-theme').click(function() {
			var t = (parseInt($(this).data('theme'))+1) % 2;
			localStorage.theme = t;
			
			Planner.theme(t);
			$(this).data('theme', t).html( Planner.UI.themes[ (t+1)%2 ] );
			return false;
		});
		if(localStorage.theme) {
			Planner.theme(localStorage.theme);
			$('#btn-theme').data('theme', localStorage.theme).html( this.UI.themes[(parseInt(localStorage.theme)+1) % 2] );
		} else {
			$('#btn-theme').data('theme', 0 ).html( this.UI.themes[1] );
		}
		
		// ical
		$('#ical-data').click(function() {
			$(this).select();
		});
		$('#btn-ical').click(function() {
			$('#ical-data').text(Planner.exportIcal());
			Planner.dialog( $('#ical') );
			return false;
		});
		
		// diary close
		$('#diary-close').click(function() {
			this.diary_open = true;
			Planner.UI.diary_wrap.hide();
			return false;
		});

		this.updateTime();
		window.setInterval(function() {
			Planner.updateTime();
		}, 1000);

		this.UI.resize = function() {
			var wh = $(window).height(),
				ww = $(window).width(),
				ch = 0;
			var min = ( Math.min(ww, wh) );
			min = ( Math.max(min, 400) );
			
			ch = min/1.2;
			Planner.UI.calendar.width( ch );
			Planner.UI.calendar.height( ch );
			
			$('td').css('width', ch/7);

			Planner.UI.diary_wrap.height('auto');
			Planner.UI.calendar_wrap.height('auto');

			var box_height = Math.max(Planner.UI.calendar_wrap.outerHeight(), Planner.UI.diary_wrap.outerHeight(), wh);
			
			Planner.UI.calendar_wrap.height( box_height );
			Planner.UI.diary_wrap.height( box_height );

			Planner.UI.diary_wrap.width('auto');

			if( Planner.UI.calendar_wrap.outerWidth() + Planner.UI.diary_wrap.outerWidth() >  ww ) {
				$('body').addClass('compact');
			} else {
				$('body').removeClass('compact');
			}
		};
		$(window).resize(function() {
			Planner.UI.resize();
		});
	},
	renderCalendar: function() {
		document.location.href = '#' + ( this.month+1 + '-' + this.year );
		
		// rest of the days
		var wn = 0,
			tblweek = null,
			table = $('<tbody class="month'+this.month+'">');
						
		if(this.weekstart > 0) {
			tblweek = $('<tr>').addClass('w0');

			// blank days
			for(var i=0; i<this.weekstart; i++) {
				tblweek.append($('<td class="day">'));
			}
			table.append(tblweek);
			wn++;
		}

		for(var d=1; d <=this.num_days; d++) {
			var w = (this.weekstart+d-1)%7;
			if(w == 0) {	// new week
				tblweek = $('<tr>');
				table.append(tblweek);
				wn++;
			}

			var id = d+'-'+this.month+'-'+this.year;
			tblweek.append(
				$('<td valign="top" class="day">').addClass('day'+d).addClass('day'+id)
					.append( $('<div class="'+id+'">')
								.append( $('<span class="d">').html(d) )
								.append(
									$('<a href="#" title="add an event" class="round add">+</a>')
									.data('id', id)
									.click(function() {
										Planner.addPrompt($(this).data('id'));
										return false;
									})
								)
					).data('id', id).click(function() {
						Planner.renderDiary( $(this).data('id') );
						Planner.showDiary();
					})
			);
		}
		$('#calendar-title').html(this.MONTHS[this.month] + ' ' + this.year);
		$('tbody').replaceWith(table);

		// today
		$('.month' + new Date().getMonth() + ' .day' + this.date).addClass('today');
		$('.month' + this.month + ' .day' + this.date).addClass('marked');
		

		$('td.day').hover(function() {
			$(this).find('.add').stop().animate({opacity: 1}, 300);
		}, function() {
			$(this).find('.add').stop().animate({opacity: 0}, 200);
		});

		this.renderEvents();
	},
	renderEvents: function() {
		$('.d .events').remove();
		
		for(var id in this.EVENTS) {
			var ul = $('<ul>');
			$.each(this.EVENTS[id], function() {
				ul.append(
					$('<li class="label '+this.label+'">').append(
						$('<span class="time">' + this.hour + ':' + this.minute + '</span>')
					).append(
						$('<span class="desc">' + this.description + '</span>')
					)
				);
			});
			
			$('.'+id).append(ul);
		}
		
		var stats = this.stats();
		$('#stats').html( stats.future + ' upcoming events and ' + stats.past + ' past events' );
	},
	showDiary: function() {
		this.diary_open = true;
		this.UI.diary_wrap.show();
	},
	renderDiary: function(id) {
		$('#diary li').remove();
		$('#diary-title').html( this.dateStringID(id) );
		
		$('.day').removeClass('selected');
		$('.day'+id).addClass('selected');
		
		for(var i=0; i<24; i++) {
			var hour = ('0' + i);
			hour = hour.substr(hour.length-2);

			$('#diary').append(
				$('<li>').append(
					$('<a href="#" class="time">' + hour + ':00</a>').data({hour: hour, minute: '00'})
					.data('hour', hour)
					.click(function() {
						Planner.addPrompt(id, null, $(this).data('hour'), '00');
						return false;
					})
				).append('<div class="clear"> </div>')
				.addClass('hour'+hour)
			);
		}
		
		if(!this.EVENTS[id]) return;

		var removals={};
		$.each(this.EVENTS[id], function(i) {
			$('#diary .hour'+this.hour).after(
				$('<li>').append(
					$('<a href="#" class="time label '+this.label+'">' + this.hour + ':' + this.minute + '</a>')
					.click(function() {
						Planner.addPrompt(id, i);
						return false;
					})
				).append(
					$('<span class="desc">' + this.description + '&nbsp;</span>')
				).append('<div class="clear"> </div>')
			);
			if(parseInt(this.minute) === 0) {
				removals[this.hour] = true;
			}
		});

		// remove redundant hours
		for(var r in removals) {
			$('#diary .hour' + r).remove();
		}
	},
	dialog: function(target) {
		this.UI.dialog.find('.target').hide();
		target.show();
		
		// position
		this.UI.dialog.width( this.UI.calendar.width()/2 );
		this.UI.dialog.css('top', ( $(window).height() - this.UI.dialog.height())/2)
					.css('left', ( this.UI.calendar.width() - this.UI.dialog.width())/2);

		this.UI.dialog.show();
	},
	closeDialog: function() {
		this.UI.dialog.hide();
	},
	addPrompt: function(id, i, hour, minute) {
		this.new_id = id;
		this.event_i = null;

		this.UI.event_description.val('');
		this.UI.event_label.find('input:first').attr('checked', 'checked');
		
		this.UI.event_tweet.hide();
		this.UI.event_delete.hide();
		
		// passing an existing item
		if(id && i != null&& this.EVENTS[id][i]) {
			this.UI.event_description.val( this.EVENTS[id][i].description );
			this.UI.event_hour.val( this.EVENTS[id][i].hour );
			this.UI.event_minute.val( this.EVENTS[id][i].minute );
			this.UI.event_label.find('.' + this.EVENTS[id][i].label + ' input').attr('checked', 'checked');
		
			this.event_i = i;
			this.UI.event_delete.data({id: id, i: i}).show();
			this.UI.event_tweet.data({id: id, i: i}).show();
		} else if(hour && minute) {
			this.UI.event_hour.val( hour );
			this.UI.event_minute.val( minute );		
		}
		
		$('#event-date').html( this.dateStringID(id) );
		this.dialog( this.UI.add );
		this.UI.event_description.focus();
		
		return false;
	},
	closeAddPrompt: function() {
		this.closeDialog();
	},
	deleteEvent: function(id, i) {
		this.EVENTS[id].splice(i,1);
		localStorage['events'] = JSON.stringify(this.EVENTS);
	},
	createEvent: function(id, hour, minute, description, label, i) {
		if(!this.EVENTS[id]) {
			this.EVENTS[id] = [];
		}

		var entry = {
				description: description,
				hour: hour,
				minute: minute,
				label: label
		};
		if(!i || i == null) {
			this.EVENTS[id].push(entry);
		} else {
			this.EVENTS[id][i] = entry;
		}
		
		this.EVENTS[id].sort(function(a, b) {
			return parseInt(a.hour+''+a.minute) -  parseInt(b.hour+''+b.minute);
		});
		
		localStorage['events'] = JSON.stringify(this.EVENTS);
	},
	
	exportIcal: function() {
		var ical = '';
		
		ical = 'BEGIN:VCALENDAR\nMETHOD:PUBLISH\nVERSION:2.0\nCALSCALE:GREGORIAN\n\n';
		for(var id in this.EVENTS) {
			var date = Planner.dateFromID(id);

			$.each(this.EVENTS[id], function() {
				ical+= 'BEGIN:VEVENT\n';
				ical+= 'DTSTART:'+ [date.getFullYear(), date.getMonth().pad(2), date.getDate().pad(2), 'T', this.hour, this.minute, '00'].join('') +'\n';
				ical+= 'SUMMARY:'+this.description+'\n';
				ical+= 'END:VEVENT\n\n';
			});
		}
		ical+='\nEND:VCALENDAR';
		
		return ical;
	},
	
	
	today: function() {
		this.Date = new Date();
		this.setDate();
		this.renderCalendar();
	},
	nextMonth: function() {
		this.Date.setMonth(this.month+1);
		this.setDate();
		this.renderCalendar();
	},
	previousMonth: function() {
		this.Date.setMonth(this.Month-1 < 0 ? 11 : this.month-1);
		this.setDate();
		this.renderCalendar();
	},
	specificMonth: function(m, y) {
		this.Date.setMonth(m-1);
		this.Date.setYear(y);
		this.setDate();
		this.renderCalendar();	
	},
	
	weekDay: function(d) {
		return (d-1).mod(7);
	},
	setDate: function() {
		this.day = this.Date.getDay();
		this.weekstart = new Date(this.Date.getTime());
		this.weekstart.setDate(1);
		this.weekstart = this.weekDay( this.weekstart.getDay() );

		this.date = this.Date.getDate();
		this.month = this.Date.getMonth();
		this.year = this.Date.getFullYear();
		
		this.num_days = 32 - new Date(this.year, this.month, 32).getDate();
	},
	dateStringID: function(id) {
		var date = this.dateFromID(id),
			d = date.getDate()
		
		d+=(d>10 && d<20 ? 'th' : {1:'st', 2:'nd', 3:'rd'}[d % 10] || 'th');
		
		return this.DAYS[ this.weekDay( date.getDay() ) ] + ', ' +
				d + ' ' + this.MONTHS[date.getMonth()] + ', ' + date.getFullYear();
	},
	dateFromID: function(id) {
		id = id.split('-');
		return new Date(id[2], id[1], id[0]);
	},
	updateTime: function() {
		var time = new Date();
		$('#time').html( time.getHours().pad(2) + ':' + time.getMinutes().pad(2) );
	},
	stats: function() {
		var stats = {past: 0, future: 0};

		var today = new Date();
		for(var id in this.EVENTS) {
			var date = Planner.dateFromID(id);

			if(date.getTime() > today.getTime()) {
				stats.future++;
			} else {
				stats.past++;
			}
		}
		
		return stats;
	},
	theme: function(theme) {
		$('body').removeClass(Planner.UI.themes.join(' ')).addClass( Planner.UI.themes[theme] );
	}
};

Number.prototype.mod = function(n) {
	return ((this%n)+n)%n;
};
Number.prototype.pad = function(n) {
	var val = '0' + this;
	return val.substr(val.length-n);
};

$(document).ready(function() {
	Planner.init();
});
