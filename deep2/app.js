var $setup, $dataReady, $status, $setupButton;
var db;
var forum;
var key = 'XrkXWYcSYFsQC74AMA9J37tNXuWbw0PwRl2DZSx3LHfu3pMJMio8Gts9qUAMBAV5';


$(document).ready(function() {

	Chart.defaults.global.elements.rectangle.backgroundColor = 'rgba(75,192,192,1)';

	$setup = $('#setup');
	$dataReady = $('#dataReady');
	$status = $('#status');
	$setupButton = $('.setupButton');

	/*
	On setup, we need to determine if we've stored data before. This would be a forum name, 
	and a date marker (which is either when we hit our rate limit or the current date).
	For v1, just current date.

	Storage will be:
		lastForum: Name of last forum (string)
		lastCheck: date
		forums: Array of objects with name(string) and lastComment(date)

	So we check for these values. If none, we prompt to enter a forum name.
	If we have them, we ask the user if they want to get latest, but also let them enter a new name and pick an old one
	*/

	var previous = checkStorage();
	console.log('previous', previous);
	if(!previous.lastForum) {
		$('#noPrevious').fadeIn();
		$setupButton.on('click', function(e) {
			e.preventDefault();
			var f = $('#newForum').val();
			if(f === '') return;
			forum = f;
			setup(forum);
		});
	} else {
		$('#lastCheck').text(previous.lastCheck);
		$('#oldForum').val(previous.lastForum);
		$('#hasPrevious').fadeIn();
		$setupButton.on('click', function(e) {
			e.preventDefault();
			var f = $('#oldForum').val();
			if(f === '') return;
			forum = f;
			if(forum === previous.lastForum) {
				setup(forum, previous.lastCheck);
			} else {
				setup(forum);
			}
		});

	}

});

function checkStorage() {
	var result = {};

	/* we assume if we have lastForum, we have it all - this is a bit brittle */
	if(localStorage.getItem('lastForum')) {
		result.lastForum = localStorage.getItem('lastForum');
		result.lastCheck = new Date(parseInt(localStorage.getItem('lastCheck'),10));
		result.forums = JSON.parse(localStorage.getItem('forums'));
	}

	return result;
}

function setup(name,lastCheck) {
	console.log('setup('+name+')');
	status('Preparing database for '+name);
	initDb(name).then(function() {
		console.log('ok, db done');
		getData(lastCheck);
	}).catch(function(e) {
		//todo - handle errors (hahahahahahah)
	});

}

function initDb(forum) {
	var def = new $.Deferred();

	/*
	Begin by creating an IDB name based on forum. This lets us have one db per forum
	*/
	var dbName = 'disqus_'+forum;
	var req = window.indexedDB.open(dbName, 1);

	req.onupgradeneeded = function(event) {
		console.log('initial db setup');
		var theDb = event.target.result;

		//create a store for posts
		var postOS = theDb.createObjectStore("posts", { keyPath:"id" });
		postOS.createIndex("created", "created", { unique: false});
		postOS.createIndex("authorName", "author.name", { unique: false});
		postOS.createIndex("thread", "thread.id", { unique: false});
		postOS.createIndex("dow", "dow", { unique: false});
		
	}

	req.onsuccess = function(event) {
		db = event.target.result;
		console.log('We made the db.');
		def.resolve();
	}

	req.onerror = function(e) {
		console.log('Error setting up IDB db');
		console.dir(e);
		def.reject(e);
	}

	return def;

}

function getData(last) {
	if(!last) {
		//assumption is that no comments existed before then
		last = new Date(1980,0,1);
	}
	console.log('prev for date is '+last);
	status('Preparing to load data.');
	doPosts(forum,last).then(function(posts) {
		console.log('done with posts');
		status('Done retrieving comments. Now storing locally.');
		storeData(posts).then(function() {
			console.log('stored locally');
			markLastSync();
			status('');
			doStats();
		});
	});
}

function doStats() {
	$setup.fadeOut(function() {
		$dataReady.fadeIn();
	});

	/*
	ok, call ALL the stat functions and let em run as is
	should be in a module maybe
	*/
	getTotalComments().then(function(count) {
		$('#totalComments').text(count);
	});

	getAvgComments();

	getFirstAndLastComments().then(function(first,last) {

		$('#firstComment').text(displayDate(first));
		$('#lastComment').text(displayDate(last));	

		getCommentsPerYear(first.getFullYear(),last.getFullYear()).then(function(result) {
			//get the keys and sort
			var years = Object.keys(result).sort();
			var yearData = [];
			years.forEach(function(year) {
				yearData.push(result[year]);
			});
			var ctx = document.getElementById("chart_byyear");

			var data = {
			    labels: years,
				datasets: [
					{
						label: "",
						fill: false,
						lineTension: 0.1,
						backgroundColor: "rgba(75,192,192,0.4)",
						borderColor: "rgba(75,192,192,1)",
						borderCapStyle: 'butt',
						borderDash: [],
						borderDashOffset: 0.0,
						borderJoinStyle: 'miter',
						pointBorderColor: "rgba(75,192,192,1)",
						pointBackgroundColor: "#fff",
						pointBorderWidth: 1,
						pointHoverRadius: 5,
						pointHoverBackgroundColor: "rgba(75,192,192,1)",
						pointHoverBorderColor: "rgba(220,220,220,1)",
						pointHoverBorderWidth: 2,
						pointRadius: 1,
						pointHitRadius: 10,
						data: yearData,
						spanGaps: false,
					}
				]
			};

			var options = {
				legend:{display:false}
			};
			var myLineChart = new Chart(ctx, {
				type: 'line',
				data: data,
				options: options
			});


		});

	});

	getCommentsPerDOW().then(function(res) {
		
		var options = {
			legend:{display:false}
		};

		var ctx = document.getElementById("chart_bydow");

		var data = {
			labels:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
			datasets:[
				{

					borderWidth:1,
					data:res
				}
			]
		}

		var myBarChart = new Chart(ctx, {
			type: 'bar',
			data: data,
			options: options
		});

	});

	getThreadStats().then(function(res) {
		var s = '';
		res.forEach(function(t) {
			s += '<tr><td><a href="'+t.link+'">'+t.title+'</a></td><td>'+t.count+'</td></tr>';
		});
		$('#threadTable tbody').append(s);
	});

	getAuthorStats().then(function(res) {
		var s = '';

		for(var i=0;i<10;i++) {
			var authorOb = res[i];
			console.dir(authorOb);
			s += `
<div class="panel panel-default">
  <div class="panel-heading">${authorOb.author.name}</div>
  <div class="panel-body">
  <img src="${authorOb.author.avatar.large.permalink}">
  ${authorOb.author.name} has posted ${authorOb.count} times. `; 
  
  			if(authorOb.author.joinedAt) s += `They joined Disqus on ${displayDate(new Date(authorOb.author.joinedAt))}. `;
  			if(authorOb.author.url) s += `Their home page is <a href="${authorOb.author.url}">${authorOb.author.url}</a>. `;

/*  
  `They joined Disqus on ${authorOb.author.joinedAt} and their
  home page is <a href="${authorOb.author.url}">${authorOb.author.url}</a>
  */
  			s += '</div></div>';

		}
		$('#topCommentersResults').html(s);
	});

}

function markLastSync() {
	/*
		lastForum: Name of last forum (string)
		lastCheck: date
		forums: Array of objects with name(string) and lastComment(date)
	*/
	localStorage.setItem('lastForum', forum);
	localStorage.setItem('lastCheck', new Date().getTime());
	var forums = localStorage.getItem('forums');
	if(forums) {
		forums = JSON.parse(forums);
	} else {
		forums = [];
	}
	//today, store an array of forums 
}

function storeData(posts) {

	var def = new $.Deferred();

	//open up the trans
	var trans = db.transaction(['posts'], 'readwrite');
	var store = trans.objectStore('posts');

	posts.forEach(function(p) {
		p.created = (new Date(p.createdAt)).getTime();
		p.dow = (new Date(p.createdAt)).getDay();
		var req = store.put(p);
		req.onerror = function(e) {
			console.log('add error', e);
		};
	});

	trans.oncomplete = function(e) {
		console.log('objects inserted');
		def.resolve();
	};

	trans.onerror = function(e) {
		console.log('Error in transaction', e);
	};

	return def;
}

function doPosts(forum, last, cursor, posts, def) {
	var url = 'https://disqus.com/api/3.0/posts/list.json?forum='+encodeURIComponent(forum)+'&since='+(last.getTime()/1000)+'&api_key='+key+'&limit=100&order=asc&related=thread';
	if(cursor) url += '&cursor='+cursor;
	if(!posts) posts = [];
	if(!def) def = new $.Deferred();
	console.log('Fetching posts.',url);
	$.get(url).then(function(res) {
		res.response.forEach(function(t) {
			posts.push(t);
		});

		if(res.cursor && res.cursor.hasNext) {
			if(posts.length > 200) {
				status('Downloaded '+posts.length+' comments.');
			}

			doPosts(forum, last, res.cursor.next, posts, def);
		} else {
			def.resolve(posts);
		}
	},'json');
	return def;
}

/*
Handler for displaying text updates.
*/
function status(str) {
	$status.html('<p><i>'+str+'</i></p>');
}

function displayDate(d) {
	//todo: use something like Moment
	return (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
}

/* 
stat functions beging here
*/

function getTotalComments() {
	var def = new $.Deferred();
	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	posts.count().onsuccess = function(e) {
		var count = e.target.result;
		console.log(count + ' total posts');
		def.resolve(count);
	}
	return def;
}

function getAvgComments() {
}

function getFirstAndLastComments() {
	var def = new $.Deferred();
	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	var first, last;
	posts.index('created').openCursor(null).onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			var d = new Date(cursor.value.created);
			first = d;
			posts.index('created').openCursor(null,'prev').onsuccess = function(e) {
				var cursor = e.target.result;
				if(cursor) {
					var d = new Date(cursor.value.created);
					last = d;
					console.log('comments from '+first+' to '+last);
					def.resolve(first,last);
				} 

			}

		}

	}	
	return def;
}

function getCommentsPerYear(first,last) {
	var def = new $.Deferred();

	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	console.log('do years from '+first+' to '+last);
	var years = [];
	for(var i = first; i<=last; i++) {
		years.push(i);
	}

	/*
	so i need a way to know when all year counts are done.
	id normally use promises and then do an All() on em. 
	but i don't think I can do so in this case. i'm probably wrong.
	so the counter is lame, i apologize
	*/
	var done = 0;
	var yearData = {};

	years.forEach(function(year) {
		var yearBegin = new Date(year,1,1).getTime();
		var yearEnd = new Date(year,11,31,23,59,59).getTime();
		var range = IDBKeyRange.bound(yearBegin, yearEnd);
		posts.index('created').count(range).onsuccess = function(e) {
			yearData[year] = e.target.result;
			done++;
			if(done === years.length) {
				def.resolve(yearData);
			}
		};
	});
	
	return def;
}

function getCommentsPerDOW() {
	var def = new $.Deferred();

	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	//see lame msg in year stat
	var done = 0;
	var dow = [];

	for(let i=0;i<7;i++) {
		let range = IDBKeyRange.only(i);
		
		posts.index('dow').count(range).onsuccess = function(e) {
			dow[i] = e.target.result;
			done++;
			if(done === 7) def.resolve(dow);
		};
		
	}
	return def;
}

function getThreadStats() {
	var def = new $.Deferred();

	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	var threads = [];
	posts.index('thread').openCursor(null,'nextunique').onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			//console.log('item', cursor.value.id, cursor.value.author.name);
			threads.push(cursor.value.thread);
			cursor.continue();
		} else {
			console.log(threads.length + ' total threads');
			//now lets sort

			var result = [];
			threads.sort(function(a,b) {
				if(a.posts > b.posts) return -1;
				if(a.posts < b.posts) return 1;
				return 0;
			});
			for(var i=0;i<10;i++) {
				result.push({title:threads[i].title, link:threads[i].link, count:threads[i].posts});
			}
			def.resolve(result);	

		}
	}
	return def;
}

function getAuthorStats() {
	var def = new $.Deferred();

	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	var authors = [];
	posts.index('authorName').openCursor(null,'nextunique').onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			//console.log('item', cursor.value.id, cursor.value.author.name);
			authors.push(cursor.value.author);
			cursor.continue();
		} else {
			console.log(authors.length + ' total authors');

			var totalAuthor = authors.length;
			var authorInfo = [];

			authors.forEach(function(author) {

				var trans = db.transaction(['posts'], 'readonly');
				var posts = trans.objectStore('posts');

				var range = IDBKeyRange.only(author.name);

				posts.index('authorName').count(range).onsuccess = function(e) {
					//console.log('result for '+author.name+' '+e.target.result);
					authorInfo.push({author:author, count:e.target.result});
					if(authorInfo.length === totalAuthor) doComplete();
				};

			});

			var doComplete = function() {
				authorInfo.sort(function(a,b) {
					if(a.count > b.count) return -1;
					if(a.count < b.count) return 1;
					return 0;
				});
				def.resolve(authorInfo);
			}


		}
	}

	return def;
}

//hidden method to nuke the db
function killme(str) {
	window.indexedDB.deleteDatabase(str);
}