/*
 Continuous Calendar (http://madebyevan.com/calendar/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

// TODO: maybe put in a way to go to any date which reloads the calendar at that date
// TODO: small resizing problem when today box moves to the next day
// TODO: need a way of exporting/importing data

function nextItemId()
{
	localStorage.nextId = localStorage.nextId ? parseInt(localStorage.nextId) + 1 : 0;
	return 'item' + localStorage.nextId;
}

// callback expects a list of objects with the itemId and itemValue properties set
function lookupItemsForParentId(parentId, callback)
{
	if(localStorage[parentId])
	{
		var parentIdsToItemIds = localStorage[parentId].split(',');
		var list = [];

		for(var i in parentIdsToItemIds)
		{
			var itemId = parentIdsToItemIds[i];
			var itemValue = localStorage[itemId];
			list.push({'itemId': itemId, 'itemValue': itemValue});
		}

		callback(list);
	}
}

function storeValueForItemId(itemId)
{
	var item = document.getElementById(itemId);
	if(item)
	{
		var parentId = item.parentNode.id;
		localStorage[itemId] = item.value;

		var parentIdsToItemIds = localStorage[parentId] ? localStorage[parentId].split(',') : [];
		var found = false;
		for(var i in parentIdsToItemIds)
		{
			if(parentIdsToItemIds[i] == itemId)
			{
				found = true;
				break;
			}
		}
		if(!found)
		{
			parentIdsToItemIds.push(itemId);
			localStorage[parentId] = parentIdsToItemIds;
		}
	}
}

function removeValueForItemId(itemId)
{
	delete localStorage[itemId];

	var item = document.getElementById(itemId);
	if(!item) return;
	var parentId = item.parentNode.id;
	if(localStorage[parentId])
	{
		var parentIdsToItemIds = localStorage[parentId].split(',');
		for(var i in parentIdsToItemIds)
		{
			if(parentIdsToItemIds[i] == itemId)
			{
				parentIdsToItemIds = parentIdsToItemIds.slice(0, i).concat(parentIdsToItemIds.slice(i + 1));
				if(parentIdsToItemIds.length) localStorage[parentId] = parentIdsToItemIds;
				else delete localStorage[parentId];
				break;
			}
		}
	}
}

var todayDate;
var firstDate;
var lastDate;
var calendarTableElement;
var itemPaddingBottom = (navigator.userAgent.indexOf('Firefox') != -1) ? 2 : 0;
var months = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

function idForDate(date)
{
	return date.getMonth() + '_' + date.getDate() + '_' + date.getFullYear();
}

function recalculateHeight(itemId)
{
	var item = document.getElementById(itemId);
	if(!item) return; // TODO: why is this sometimes null?
	item.style.height = '0px'; // item.scrollHeight doesn't shrink on its own
	item.style.height = item.scrollHeight + itemPaddingBottom + 'px';
}

function keydownHandler()
{
	recalculateHeight(this.id);
	if(this.storeTimeout) clearTimeout(this.storeTimeout);
	this.storeTimeout = setTimeout('storeValueForItemId("' + this.id + '")', 100);
}

function checkItem()
{
	if(this.value.length == 0)
	{
		removeValueForItemId(this.id);
		this.parentNode.removeChild(this);
	}
}

function generateItem(parentId, itemId)
{
	var item = document.createElement('textarea');
	var parent = document.getElementById(parentId);
	if(!parent) return; // offscreen items aren't generated
	parent.appendChild(item);
	item.id = itemId;
	item.onkeyup = keydownHandler;
	item.onblur = checkItem;
	item.spellcheck = false;
	return item;
}

document.onclick = function(e)
{
	var parentId = e.target.id;
	if(parentId.indexOf('_') == -1) return;

	var item = generateItem(parentId, nextItemId());
	recalculateHeight(item.id);
	storeValueForItemId(item.id);
	item.focus();
}

function generateDay(day, date)
{
	var isShaded = (date.getMonth() % 2);
	var isToday = (date.getDate() == todayDate.getDate() && date.getMonth() == todayDate.getMonth() && date.getFullYear() == todayDate.getFullYear());

	if(isShaded) day.className += ' shaded';
	if(isToday) day.className += ' today';

	day.id = idForDate(date);
	day.innerHTML = '<span>' + date.getDate() + '</span>';

	lookupItemsForParentId(day.id, function(items)
	{
		for(var i in items)
		{
			var item = generateItem(day.id, items[i].itemId);
			item.value = items[i].itemValue;
			recalculateHeight(item.id);
		}
	});
}

function prependWeek()
{
	var week = calendarTableElement.insertRow(0);
	var monthName = '';

	// move firstDate to the beginning of the previous week assuming it is already at the beginning of a week
	do
	{
		firstDate.setDate(firstDate.getDate() - 1);
		if(firstDate.getDate() == 1) monthName = months[firstDate.getMonth()] + '<br />' + firstDate.getFullYear();

		var day = week.insertCell(0);
		generateDay(day, firstDate);
	} while(firstDate.getDay() != 0);

	var extra = week.insertCell(-1);
	extra.className = 'extra';
	extra.innerHTML = monthName;
}

function appendWeek()
{
	var week = calendarTableElement.insertRow(-1);
	var monthName = '';

	// move lastDate to the end of the next week assuming it is already at the end of a week
	do
	{
		lastDate.setDate(lastDate.getDate() + 1);
		if(lastDate.getDate() == 1) monthName = months[lastDate.getMonth()] + '<br />' + lastDate.getFullYear();

		var day = week.insertCell(-1);
		generateDay(day, lastDate);
	} while(lastDate.getDay() != 6)

	var extra = week.insertCell(-1);
	extra.className = 'extra';
	extra.innerHTML = monthName;
}

function scrollPositionForElement(element)
{
	// find the y position by working up the DOM tree
	var clientHeight = element.clientHeight;
	var y = element.offsetTop;
	while(element.offsetParent && element.offsetParent != document.body)
	{
		element = element.offsetParent;
		y += element.offsetTop;
	}

	// center the element in the window
	return y - (window.innerHeight - clientHeight) / 2;
}

function scrollToToday()
{
	window.scrollTo(0, scrollPositionForElement(document.getElementById(idForDate(todayDate))));
}

var startTime;
var startY;
var goalY;

function curve(x)
{
	return (x < 0.5) ? (4*x*x*x) : (1 - 4*(1-x)*(1-x)*(1-x));
}

function scrollAnimation()
{
	var percent = (new Date() - startTime) / 1000;

	if(percent > 1) window.scrollTo(0, goalY);
	else
	{
		window.scrollTo(0, Math.round(startY + (goalY - startY) * curve(percent)));
		setTimeout('scrollAnimation()', 10);
	}
}

function documentScrollTop()
{
	var scrollTop = document.body.scrollTop;
	if(document.documentElement) scrollTop = Math.max(scrollTop, document.documentElement.scrollTop);
	return scrollTop;
}

function documentScrollHeight()
{
	var scrollHeight = document.body.scrollHeight;
	if(document.documentElement) scrollHeight = Math.max(scrollHeight, document.documentElement.scrollHeight);
	return scrollHeight;
}

function smoothScrollToToday()
{
	goalY = scrollPositionForElement(document.getElementById(idForDate(todayDate)));
	startY = documentScrollTop();
	startTime = new Date();
	if(goalY != startY) setTimeout('scrollAnimation()', 10);
}

// TODO: when scrolling down, safari sometimes scrolls down by the exact height of content added
function poll()
{
	// add more weeks so you can always keep scrolling
	if(documentScrollTop() < 200)
	{
		var oldScrollHeight = documentScrollHeight();
		for(var i = 0; i < 8; i++) prependWeek();
		window.scrollBy(0, documentScrollHeight() - oldScrollHeight);
	}
	else if(documentScrollTop() > documentScrollHeight() - window.innerHeight - 200)
	{
		for(var i = 0; i < 8; i++) appendWeek();
	}

	// update today when the date changes
	var newTodayDate = new Date;
	if(newTodayDate.getDate() != todayDate.getDate() || newTodayDate.getMonth() != todayDate.getMonth() || newTodayDate.getFullYear() != todayDate.getFullYear())
	{
		// TODO: resize all items in yesterday and today because of the border change

		var todayElement = document.getElementById(idForDate(todayDate));
		if(todayElement) todayElement.className = todayElement.className.replace('today', '');

		todayDate = newTodayDate;

		todayElement = document.getElementById(idForDate(todayDate));
		if(todayElement) todayElement.className += ' today';
	}
}

function loadCalendarAroundDate(seedDate)
{
	calendarTableElement.innerHTML = '';
	firstDate = new Date(seedDate);

	// move firstDate to the beginning of the week
	while(firstDate.getDay() != 0) firstDate.setDate(firstDate.getDate() - 1);

	// set lastDate to the day before firstDate
	lastDate = new Date(firstDate);
	lastDate.setDate(firstDate.getDate() - 1);

	// generate the current week (which is like appending to the current zero-length week)
	appendWeek();

	// fill up the entire window with weeks
	while(documentScrollHeight() <= window.innerHeight)
	{
		prependWeek();
		appendWeek();
	}

	// need to let safari recalculate heights before we start scrolling
	setTimeout('scrollToToday()', 50);
}

window.onload = function()
{
	calendarTableElement = document.getElementById('calendar');
	todayDate = new Date;

	loadCalendarAroundDate(todayDate);
	setInterval('poll()', 100);
}

function showHelp() { document.getElementById('help').style.display = 'block'; }
function hideHelp() { document.getElementById('help').style.display = 'none'; }

document.write('<div id="header"><a class="button" href="javascript:smoothScrollToToday()">Scroll to today</a><a class="button" href="javascript:showHelp()">Help</a>&nbsp; by <a href="/calendar/">Evan Wallace</a></div>');
document.write('<table id="calendar"></table>');
document.write('<div id="help"><div><ul><li>Click on a day to add a note</li><li>To delete a note, delete its text</li><li>Use the scroll wheel to move forward or backward in time</li></ul><a class="button" href="javascript:hideHelp()">Close</a></div></div>');
