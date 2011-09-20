/*
 * RAM v1.00 [http://ram.nepplication.cz]
 * Simple TODO list manager. 
 *  
 * by Jan Pomahac [http://www.nepplication.cz], august 2011
 * for 10K Apart
 *  
 */

var RAMapp = {
	SPEED_ADD: 50,
	SPEED_BOX_CLOSE: 200,
	SPEED_BOX_OPEN: 400,
	SPEED_HELP: 400,
	SPEED_BUTTON: 200,
	SPEED_INFO: 200,
	COLORS:	['fff', '990000', 'cc0000', 'cc3333', 'ea4c88', '993399', '663399', '333399', '0066cc', '0099cc', '66cccc', '77cc33', '669900', '336600', '666600', '999900', 'cccc33', 'ffff00', 'ffcc33', 'ff9900', 'ff6600'],
	COLORS_INFO: ['888', '888', 'aaa', 'aaa', 'eee', '888', '888', '888', '888', '888', 'eee', 'eee', 'eee', '888', '888', 'eee', 'eee', '888', '888', 'eee', '888'],
	BASE_GRAY: '#999999',
	
	loadApp: function () {
		$('#nojs').remove();
		if (localStorage.getItem("isZoom")) {
			$('html').css('fontSize', localStorage.getItem("zoom"));
		}	
		if (localStorage.getItem("isDisHelp") == 1) {
			this.initApp();
			$('#startuphelp').attr('checked', 'checked');
		} else {
			$('header').animate({
				height : '14em'
			}, this.SPEED_HELP, function () {
				$('#info').fadeIn(RAMapp.SPEED_INFO);
				var h = $('#block-start').height();
				$('#block-start').css('marginTop', '-' + h + 'px');
				$('#block-start').show();
				$('#block-start').animate({marginTop : '0px'}, RAMapp.SPEED_BUTTON);
				$('#button-start').click(function () {
					RAMapp.initApp();
					return false;
				});
			});
		}
	},
	
	initApp: function () {
		$('#info').fadeOut(this.SPEED_INFO, function () {
			$('header').animate({
				height : '5em'
			}, RAMapp.SPEED_HELP, function () {
				$('header').data('isHelp', 0);
				RAMapp.help();
				$('#info').click(function (event) {
					event.stopPropagation();
				});
				RAMapp.addButtons();
			});
			$('#button-start').remove();
			var isHelp = $('<p class="help-note"><input type="checkbox" id="startuphelp" /> <label for="startuphelp">Don\'t display this message at start!</label> </p>');
			isHelp.click(function () {
				if ($('#startuphelp').is(":checked")) {
					localStorage.setItem("isDisHelp", 1);
				} else {
					localStorage.setItem("isDisHelp", 0);
				}
			});
			$('#info').append(isHelp);
		});
		var h = $('#block-start').height(),
			lis = "",
			count = localStorage.getItem("cells"),
			i = 1,
			text = "",
			info = "",
			col = "",
			style = "",
			addClass = "";
		$('#block-start').animate({marginTop : '-' + h + 'px'}, this.SPEED_BUTTON, function () {
			$('#block-start').remove();
		});
		if (count < 1) {
			count = 20;
			localStorage.setItem("cells", count);
		}

		this.addCell(1,count);
		
		$(window).resize(function () {
			RAMapp.boardResize();
		});
						
		$('#adderAdd').click(function () {
			var newBox = $(this).parent().parent().parent().clone(),
				num = $('#board').find("li").length;
			localStorage.setItem("cells", num + 1);
			newBox.attr('id', 'box' + num);
			newBox.find('.no').html('.' + RAMapp.formatNumber(num));
			newBox.find('#adderAdd').remove();
			newBox.find('#adderDel').remove();
			newBox.find('article').mouseenter(function () {
				RAMapp.boxOver($(this));
			}).mouseleave(function () {
				RAMapp.boxOut($(this));
			}).click(function () {
				RAMapp.boxClick($(this));
			});
			$('#board').find('li:last').before(newBox);
		});
		
		$('#adderDel').click(function () {
			var num = $('#board').find("li").length - 1;
			localStorage.setItem("cells", num);
			localStorage.removeItem('box' + num + "_text");
			localStorage.removeItem('box' + num + "_date");
			localStorage.removeItem('box' + num + "_color");
			$('#board').find('li:last').prev('li').remove();
		});
		
		$(document).keyup(function (e) {
			if (e.keyCode == 27) {
				RAMapp.closeBox();
			} 
			if (e.keyCode == 13) {
				if ($('#temp li').length) {
					RAMapp.saveBox();
				}
				if ($('#board').find("li > article:focus").length) {
					$('#board').find("li > article:focus").click();
				}
			} 
		});
	},
	
	addCell: function (i,max) {
		text = localStorage.getItem("box" + i + "_text");
		if (text == null) {
			text = "";
		}
		info = localStorage.getItem("box" + i + "_date");
		if (info == null) {
			info = "";
		}
		col = localStorage.getItem("box" + i + "_color");
		if (col != null && col != "") {
			style = "background-color: " + col + "; border-color:inherit";
			addClass = "done";
		} else {
			style = "";
			addClass = "";
		}
		
		lis = $('<li  id="box' + i + '"><article tabindex="' + i + '" class="empty ' + addClass
			+ '" style="' + style + '"><span class="no">.'
			+ this.formatNumber(i) + '</span><span class="info">' + info
			+ '</span><span class="text">' + text
			+ '</span></article></li>');
		
		$('#board li:last').before(lis);
		lis.fadeIn(RAMapp.SPEED_ADD, function () {
			i++;
			if (i >= max) {
				RAMapp.addCellEnd();
			} else{
				RAMapp.addCell(i, max);
			}	
		});
	},
	
	addCellEnd: function () {
		$('#board').find("li > article:not(.adder)").mouseenter(function () {
			RAMapp.boxOver($(this));
		}).mouseleave(function () {
			RAMapp.boxOut($(this));
		}).click(function () {
			RAMapp.boxClick($(this));
		});
		$('#board li:last').fadeIn(RAMapp.SPEED_BUTTON);
	},
		
	addColorPicker: function (el) {
		var cp = $('<a href="#" id="changeColor">Color</a>');
		cp.click(function () {
			var idx = $(this).data('color');
			if (idx == undefined) {
				idx = 0;
			}
			idx++;
			if (idx > (RAMapp.COLORS.length - 1)) {
				idx = 0;
			}
			$(this).data('color', idx);
			$(this).parents("article").css('backgroundColor', "#" + RAMapp.COLORS[idx]);
			$(this).parents("article").css('borderColor', "#" + RAMapp.COLORS[idx]);
			$(this).parents("article").css('color', "#" + RAMapp.COLORS_INFO[idx]);
			return false;
		});
		el.append(cp);
	},

	addSaveButton: function (el) {
		var save = $('<a href="#" id="saveCell">Save</a>');
		save.click(function () {
			RAMapp.saveBox();
			return false;
		});
		el.append(save);
	},
	
	addDeleteButton: function (el) {
		var del = $('<a href="#" id="deleteCell">Delete</a>');
		del.click(function () {
			var id = $('#board').data('editBox');
			$('#' + id).find('.info').html('');
			$('#' + id).find('.text').html('');
			$('#' + id).find('article').removeClass('done');
			$('#' + id).find('article').css('borderColor', RAMapp.BASE_GRAY);
			$('#' + id).find('article').css('backgroundColor', 'inherit');
			localStorage.removeItem(id + "_text");
			localStorage.removeItem(id + "_date");
			localStorage.removeItem(id + "_color");
			RAMapp.closeBox(true);
			return false;
		});
		el.append(del);
	},
	
	addButtons: function () {
		var themeCol = Math.floor(Math.random() * (360 + 1));
		localStorage.setItem("themeCol", themeCol);
		$('#tools').append('<section id="block-filter" style="background-color: hsl(' + themeCol + ',60%,40%);"><h1>tag cloud</h1><div class="content-wrapper clearfix"><div class="content clearfix"></div></div></section>');		
		$('#tools').append('<section id="block-data" style="background-color: hsl(' + themeCol + ',60%,48%);"><h1>data</h1><div class="content-wrapper clearfix"><div class="content"><a href="#dataDelete" id="dataDelete">Delete all tasks</a><a href="#dataTest" id="dataTest">Load sample data</a><a href="#dataExport" id="dataExport">Export data</a><a href="#dataImport" id="dataImport">Import data</a></div></div></section>');
		$('#tools').append('<section id="block-size" style="background-color: hsl(' + themeCol + ',60%,56%);"><h1>text size</h1><div class="content-wrapper clearfix"><div class="content clearfix"></div></div></section>');
		$('#tools').append('<section id="block-colors" style="background-color: hsl(' + themeCol + ',60%,64%);"><h1>colors</h1><div class="content-wrapper clearfix"><div class="content clearfix"><a href="#" id="colorizer">colorize theme</a></div></div></section>');
		
		$('#block-size div.content').append('<a href="#" id="zoom-in" class="rb">+</a>');
		$('#block-size div.content').append('<a href="#" id="zoom-out" class="rb">&minus;</a>');
		$('#block-size div.content').append('<div id="zoom-save-wrapper"><input type="checkbox" id="zoom-save" /><label for="zoom-save">Remember zoom</label></div>');

		this.animateButton(['block-filter', 'block-data', 'block-size', 'block-colors']);
	},
	
	buttonsAdded: function () {
		$('#zoom-in').click(function () {
			$('html').css('fontSize', "+=2");
			if (localStorage.getItem("isZoom")) {
				localStorage.setItem("zoom", $('html').css('fontSize'));
			}
			return false;
		});
		
		$('#zoom-out').click(function () {
			$('html').css('fontSize', "-=2");
			if (localStorage.getItem("isZoom")) {
				localStorage.setItem("zoom", $('html').css('fontSize'));
			}
			return false;
		});
		$('#zoom-save-wrapper').click(function () {
			if ($('#zoom-save').is(":checked")) {
				localStorage.setItem("isZoom", true);
				localStorage.setItem("zoom", $('html').css('fontSize'));
			} else {
				localStorage.removeItem("isZoom");
			}
		});
		
		$('#colorizer').click(function () {
			var count = localStorage.getItem("cells"),
				b = 30,
				themeCol = localStorage.getItem("themeCol"),
				i = 0,
				col = "";
			for (i = 1; i < count; i = i + 1) {
				col = localStorage.getItem("box" + i + "_color");
				if (col != null && col != '') {
					b += (100 / count);
					col = 'hsl(' + themeCol + ',85%, ' + b + '%)';
					$('#board #box' + i + ' article').css('backgroundColor', col);
					localStorage.setItem("box" + i + "_color", col);
				}
			}
			return false;
		});
		
		$('#dataDelete').click(function () {
			RAMapp.dialog('Data delete', 'Do you realy want to delete all tasks?');
			$('#temp textarea').remove();
			$('#temp p').css('height', '15em');
			$('#temp #dataOk').click(function () {
				$('#temp p').html("Processing... plaease wait.");
				RAMapp.dataDelete();
				$('#temp').hide();
				$('#temp').removeClass('dialog');
				$('#dialog').remove();
				return false;	
			});
			return false;
			
		});
		
		$('#dataTest').click(function () {
			RAMapp.dialog('Sample data import', 'Do you realy want to import sample tasks? All current data will be deleted.');
			$('#temp textarea').remove();
			$('#temp p').css('height', '15em');
			$('#temp #dataOk').click(function () {
				$('#temp p').html("Processing... plaease wait.");
				var loremIpsum = "Lorem ipsum dolor sit amet. consectetur adipiscing elit. Praesent sodales. justo id eleifend dignissim. ante odio aliquam nulla. commodo blandit libero sapien sit amet massa. Fusce non enim lobortis lectus posuere aliquet eu eget sem. Pellentesque blandit ultricies ultricies. Nullam dapibus auctor augue. a feugiat elit auctor et. Nullam justo risus. ultrices non pharetra ac. auctor non tortor. Nulla non lobortis felis. Sed consectetur ullamcorper dictum. Donec tincidunt euismod consectetur",
					tasks = loremIpsum.split("."),
					i = 0,
					col = "";
				RAMapp.dataDelete();
				for (i = 0; i < tasks.length; i++) {
					col = Math.floor(Math.random() * (RAMapp.COLORS.length));
					RAMapp.saveCell('box' + (i + 1), tasks[i], '#' + RAMapp.COLORS[col], '#' + RAMapp.COLORS_INFO[col]);
				}
				RAMapp.tagCloud();
				$('#temp').hide();
				$('#temp').removeClass('dialog');
				$('#dialog').remove();
				return false;	
			});
			return false;
		});
		
		$('#dataImport').click(function () {
			RAMapp.dialog('Data Import', 'Insert plain text task list. One row one task. Imported tasks will be added after last active task.');
			$('#temp #dataOk').click(function () {
				var importText = RAMapp.stripTags($('#temp textarea').val()),
					tasks = importText.split("\n"),
					count = parseInt(localStorage.getItem("cells")),
					lastID = count,
					col = "",
					i = 0;
				
				while (localStorage.getItem("box" + lastID + "_color") == null || localStorage.getItem("box" + lastID + "_color") == '') {
					lastID--;
					if (lastID < 0) {
						break;
					}
				}
				if (lastID < 0) {
					lastID = count;
				}
				if ((lastID + tasks.length) > count) {
					for (i = lastID; i < (lastID + tasks.length); i++) {
						$('#adderAdd').click();
					}
				}
				
				for (i = 0; i < tasks.length; i++) {
					col = Math.floor(Math.random() * (RAMapp.COLORS.length));
					RAMapp.saveCell('box' + (lastID + i + 1), tasks[i], '#' + RAMapp.COLORS[col], '#' + RAMapp.COLORS_INFO[col]);
				}
				
				RAMapp.tagCloud();
				$('#temp').hide();
				$('#temp').removeClass('dialog');
				$('#dialog').remove();
			});
			return false;
		});
		
		$('#dataExport').click(function () {
			var list = "",
				i = 0;
			RAMapp.dialog('Data Export', 'Plain text task list.');
			for (i = 1; i < localStorage.getItem("cells"); i = i + 1) {
				if (localStorage.getItem("box" + i + "_color") != null && localStorage.getItem("box" + i + "_color") != '') {
					list += "[" + localStorage.getItem("box" + i + "_date") + "] " + localStorage.getItem("box" + i + "_text") + "\n";
				}
			}
			$('#temp textarea').val(list);
			$('#temp textarea').attr('readonly', 'readonly');
			$('#temp #dataOk').remove();
			$('#temp #dataCancel').html('Close');
			return false;
		});
		
		this.tagCloud();
		
		if (localStorage.getItem("isZoom")) {
			$('#zoom-save').attr('checked', 'checked');
		}
		
		$('#tools h1').click(function () {
			var obj = $(this).next('div');
			if (!obj.is(':animated')) {
				if (obj.is(':visible')) {
					obj.slideUp(RAMapp.SPEED_BOX_OPEN);
				} else {
					obj.slideDown(RAMapp.SPEED_BOX_OPEN);
				}
			}
		});
	},	

	animateButton: function (col) {
		var id = col.shift();
		if (id == undefined) {
			this.buttonsAdded();
		}
		var obj = $('#' + id);
		obj.css('marginTop', '-' + obj.height() + 'px');
		obj.show();
		obj.animate({marginTop: '0px'}, RAMapp.SPEED_BUTTON, function () {
			obj.css('zIndex', 10);
			RAMapp.animateButton(col);
		});
	},
	
	dataDelete: function () {
		var obj = $('#board li[id^=box]'),
			i = 0;
		for (i = 1; i < localStorage.getItem("cells"); i = i + 1) {
			//localStorage.removeItem("box" + i + "_text");
			//localStorage.removeItem("box" + i + "_date");
			//localStorage.removeItem("box" + i + "_color");
			localStorage.setItem("box" + i + "_text", null);
			localStorage.setItem("box" + i + "_date", null);
			localStorage.setItem("box" + i + "_color", null);
			
			if (i > 20) {
				$('#board').find('li:last').prev('li').remove();
			}
		}
		localStorage.setItem("cells", 20);
		obj.find('.info').html('');
		obj.find('.text').html('');
		obj.find('article').removeClass('done');
		obj.find('article').css({'borderColor': RAMapp.BASE_GRAY, 'backgroundColor': 'inherit', 'color': RAMapp.BASE_GRAY});
		RAMapp.tagCloud();
	},
	
	closeBox: function (isSave) {
		if ($('#temp > ul > li').length) {
			if (!$('#temp > ul > li').is(':animated')) {
				$('#temp > ul > li').animate({
					fontSize : '-=200%',
					top : '+=' + $('#temp > ul > li').data('wt') / 2 + 'px',
					left : '+=' + $('#temp > ul > li').data('wl') / 2 + 'px'
				}, this.SPEED_BOX_CLOSE, function () {
					$('#temp').hide();
					$('#temp > ul > li').remove();
				});
			}
			if (!isSave) {
				$('article.active').css('backgroundColor', 'inherit');
				$('article.active').removeClass('active');
			}
		}
	},
	
	saveCell: function (id, text, bgcol, col) {
		var d = new Date();
		$('#' + id).find('.info').html('<time datetime="' + d.toUTCString() + '">' + d.toUTCString() + '</time>');
		$('#' + id).find('.text').html(text);
		$('#' + id).find('article').addClass('done');
		$('#' + id).find('article').removeClass('active');
		$('#' + id).find('article').css('borderColor', 'inherit');
		$('#' + id).find('article').css('backgroundColor', bgcol);
		$('#' + id).find('article').css('color', col);
		localStorage.setItem(id + "_text", text);
		localStorage.setItem(id + "_date", d.toUTCString());
		localStorage.setItem(id + "_color", bgcol);
	},
	   
	saveBox: function () {
		var text = this.stripTags($('#temp').find('textarea').val()),
			id = $('#board').data('editBox');
		this.saveCell(id, text, $('#temp').find('article').css('backgroundColor'), $('#temp').find('article').css('color'));
		this.closeBox(true);
		this.tagCloud();
		$('#temp').unbind('click');
	},
	
	boxOver: function (el) {
		el.data('col', Math.floor(Math.random() * (this.COLORS.length + 1)));
		if (!el.hasClass('done')) {
			el.css('borderColor', '#' + this.COLORS[el.data('col')]);
		} else {
			el.css('borderColor', this.BASE_GRAY);
		}
		el.addClass('hover');
	},
	
	boxOut: function (el) {
		if (!el.hasClass('done')) {
			el.css('borderColor', this.BASE_GRAY);
		} else {
			el.css('borderColor', 'inherit');
		}
		el.removeClass('hover');
	},
	
	boxClick: function (el) {
		$('#board').data('editBox', el.parent().attr('id'));
		var text = "", 
			box = "",
			inner = "",
			pos = 0,
			w = 0, 
			wt = 0, 
			wl = 0;
			
		if (!el.hasClass('done')) {
			el.addClass('active');
			el.css('backgroundColor', "#" + this.COLORS[el.data('col')]);
		} else {
			text = el.find('.text').text();
			el.css('borderColor', "inherit");
		}
		box = el.parent().clone();
		inner = $(box).find('article').find('.text');
	
		$(box).find('.text').html("");
		inner.append('<textarea rows="3" />');
		$(box).find('textarea').val(text);
		
		this.addColorPicker(inner);
		this.addDeleteButton(inner);
		this.addSaveButton(inner);
	
		pos = el.parent().position();
		$('#temp > ul').prepend(box);
		$('#temp > ul > li').css('top', pos.top);
		$('#temp > ul > li').css('left', pos.left);
		w = $('#temp > ul > li').width();
		wt = w;
		wl = w;
		if (pos.top < (wt / 2)) {
			wt = wt / 4;
		}
		if (pos.left < (wl / 2)) {
			wl = wl / 4;
		}
	
		if ((pos.left + (w * 2)) > $(window).width()) {
			wl = wl * 1.7;
		}
		$('#temp > ul > li').data('wt', wt);
		$('#temp > ul > li').data('wl', wl);
		$('#temp').height($(document).height());
		$('#temp').show();
		$('#temp').click(function () {
			RAMapp.saveBox();
		});
	
		$('#temp').find('li').click(function (event) {
			event.stopPropagation();
		});
	
		$('#temp > ul > li').animate({
			fontSize : '+=200%',
			top : '-=' + wt / 2 + 'px',
			left : '-=' + wl / 2 + 'px'
		}, this.SPEED_BOX_OPEN, function () {
			$('#temp').find('textarea').focus();
		});
	},
	
	boardResize: function () {
		this.closeBox();
	},
	
	tagCloud: function () {
		if ($('#tools #block-filter .content').is(':visible')) {
			$('#tools #block-filter h1').click();
		}
		
		$('#block-filter a').removeClass('active');
		$('#block-filter a').css('color', $('#block-filter a').data('color'));
		$("#board li").show();
		$("#board li:last").show();
		
		$('#block-filter div.content').html("");
		var count = localStorage.getItem("cells"),
			words = new Object(),
			max = 0,
			fontSize = 1,
			i = 0,
			ii = 0,
			wcount = 0,
			text = "",
			item = "",
			toggle = "",
			x = "",
			b = 100,
			idx = "",
			power = "",
			w = "";
		for (i = 1; i < count; i = i + 1) {
			text = localStorage.getItem("box" + i + "_text");
			if (text != null) {
				item = text.split(" ");
				for (ii = 0; ii < item.length; ii++) {
					x = item[ii].toLowerCase();
					if (x.length > 2) {
						if (words[x] != undefined) {
							words[x]++;
						} else {
							words[x] = 1;
							wcount++;
						}
						if (words[x] > max) {
							max = words[x];
						}
					}
				}	
			}
		}

		words = this.asort(words);
		for (idx in words) {
			power = words[idx];
			b -= (40 / wcount);
			toggle = $('<a href="#' + idx + '" style="color: hsl(' + localStorage.getItem("themeCol") + ',85%,' + b + '%)">' + idx + '</a>');
			toggle.click(function () {
				w = $(this).html();
				if ($(this).hasClass('active')) {
					$(this).removeClass('active');
					$(this).css('color',$(this).data('color'));
					$("#board li").show();
					$("#board li:last").show();
				} else {
					$('#block-filter a.active').each(function () {
						$(this).removeClass('active');
						$(this).css('color', $(this).data('color'));
					});
					$(this).addClass('active');
					$(this).data('color', $(this).css('color'));
					$(this).css('color', '#000');
					for (i = 1; i < count; i = i + 1) {
						isView = false;
						text = localStorage.getItem("box" + i + "_text");
						if (text != null) {
							if (text.toLowerCase().indexOf(w) != -1) {
								isView = true;
							}
						}
						if (!isView) {
							$('#box' + i).hide();
						} else {
							$('#box' + i).show();
						}
					}
					$("#board li:last").hide();
				}
				return false;
			});
			$('#block-filter div.content').append(toggle);
		}
		if ($('#block-filter div.content').html() == "") $('#block-filter div.content').html('<p>No tasks inserted</p>');
	},
	
	help: function () {
		$('#hinfo').click(function () {
			if (!($('header').is(':animated') || $('#info').is(':animated'))) {
				if ($('header').data('isHelp') != 1) {
					$('header').animate({
						height : '14em'
					}, RAMapp.SPEED_HELP, function () {
						$('#info').fadeIn(RAMapp.SPEED_INFO);
					});
					$('header').data('isHelp', 1);
				} else {
					$('header').data('isHelp', 0);
					$('#info').fadeOut(RAMapp.SPEED_INFO, function () {
						$('header').animate({
							height : '5em'
						}, RAMapp.SPEED_HELP);
					});
				}
			}
		});
	},
	
	dialog: function (title,descr) {
		$('#temp').addClass('dialog');
		$('#temp').append('<div id="dialog"><h1>' + title + '</h1><p>' + descr + '</p><textarea></textarea><a href="#ok" id="dataOk">ok</a><a href="#cancel" id="dataCancel">cancel</a></div>');
		$('#dialog').css('background', 'hsl(' + localStorage.getItem("themeCol") + ',85%, 55%)');
		$('#temp').height($(document).height());
		$('#temp').show();
		$('#temp #dataCancel').click(function () {
			$('#temp').hide();
			$('#temp').removeClass('dialog');
			$('#dialog').remove();
		});
	},
	
	formatNumber: function (num) {
		return (num < 10) ? "0" + num : num;
	},
	
	stripTags: function (text) {
		var tmp = document.createElement("DIV");
		tmp.innerHTML = text;
		return tmp.textContent||tmp.innerText;
	},
	
	asort: function (col) {
		function sortFunc(a,b) {
			return b - a;
		}	

		var temp = [],
			ret = [];
		for (var key in col) {
			if (col.hasOwnProperty(key)) temp.push({key: key, value:  col[key]});
		}

		temp.sort(function (o1, o2) {
			return sortFunc(o1.value, o2.value);
		});

		for (var key in temp) {
			 ret[temp[key].key] = temp[key].value;
		}
		return ret;		 
	}
}

jQuery(document).ready(function () {
	RAMapp.loadApp();
});
