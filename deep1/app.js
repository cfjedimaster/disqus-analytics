var $forum, $startData, $results, $displayData, $setupData;
var db;
var forum;
var key = 'XrkXWYcSYFsQC74AMA9J37tNXuWbw0PwRl2DZSx3LHfu3pMJMio8Gts9qUAMBAV5';

$(document).ready(function() {

	$forum = $('#forum');

	$setupData = $('#setupData');
	$setupData.on('click', setupData);

	$startData = $('#startData');
	$startData.on('click', doData);

	$displayData = $('#displayData');
	$displayData.on('click', doStats);

	$results = $('#results');		

});

function setupData() {
	forum = $forum.val();
	if($.trim(forum) === '') return;
	console.log('work with '+forum);
	$setupData.attr('disabled','disabled');

	initDb(function() {
		$results.html('<p><i>Db setup.</i></p>');
		$startData.removeAttr('disabled');
		$displayData.removeAttr('disabled');
	},forum);

}

function initDb(cb,forum) {
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
		
	}

	req.onsuccess = function(event) {
		db = event.target.result;
		console.log('We made the db.');
		cb();
	}

	req.onerror = function(e) {
		console.log('Error setting up IDB db');
		console.dir(e);
	}

	
}

function doData() {
	
	$results.html('<p><i>Getting data.</i></p>');
	seedData(function() {
		$results.html('<p><i>Got data.</i></p>');		
	});
};

/*
My goal is to fetch as many posts as I can. I need to recognize my latest post so that in the future
I can get posts > that date. 
*/
function seedData(cb) {

	doPosts(function(posts) {
		console.log('I get '+posts.length+' posts.');

		//open up the trans
		var trans = db.transaction(['posts'], 'readwrite');
		var store = trans.objectStore('posts');

		posts.forEach(function(p) {
			p.created = (new Date(p.createdAt)).getTime();
			var req = store.put(p);
			req.onerror = function(e) {
				console.log('add error', e);
			};
		});

		trans.oncomplete = function(e) {
			console.log('objects inserted');
			cb();
		}

		trans.onerror = function(e) {
			console.log('Error in transaction', e);
		}

	},forum);

}

function doPosts(cb, forum, cursor, posts) {
	var url = 'https://disqus.com/api/3.0/posts/list.json?forum='+encodeURIComponent(forum)+'&api_key='+key+'&limit=100&order=asc&related=thread';
	if(cursor) url += '&cursor='+cursor;
	if(!posts) posts = [];
	console.log('Fetching posts.');
	$.get(url).then(function(res) {
		res.response.forEach(function(t) {
			posts.push(t);
		});

		if(res.cursor && res.cursor.hasNext) {
			doPosts(cb, forum, res.cursor.next, posts);
		} else {
			cb(posts);
		}
	},'json');
}

function doStats() {
	console.log('do stats');

	/*
	lets parse this shit!
	*/

	var trans = db.transaction(['posts'], 'readonly');
	var posts = trans.objectStore('posts');

	/*
	number of posts
	*/
	posts.count().onsuccess = function(e) {
		var count = e.target.result;
		console.log(count + ' total posts');
	}

	/*
	unique authors
	*/
	var authors = [];
	posts.index('authorName').openCursor(null,'nextunique').onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			//console.log('item', cursor.value.id, cursor.value.author.name);
			authors.push(cursor.value.author);
			cursor.continue();
		} else {
			console.log(authors.length + ' total authors');
			doAuthorStats(authors);
		}
	}

	/*
	get range, first and last in date index
	*/
	var first, last;
	posts.index('created').openCursor(null).onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			var d = new Date(cursor.value.created);
			//console.log('first '+d);
//			cursor.continue();
			first = d;
			posts.index('created').openCursor(null,'prev').onsuccess = function(e) {
				var cursor = e.target.result;
				if(cursor) {
					var d = new Date(cursor.value.created);
					last = d;
					console.log('comments from '+first+' to '+last);
					//console.log('last '+d);
		//			cursor.continue();
				} else {
				}

			}

		} else {
		}

	}

	var years = [];
	for(var i = 2003; i<=2016; i++) {
		years.push(i);
	}

	years.forEach(function(year) {
		//test 2016
		var yearBegin = new Date(year,1,1).getTime();
		var yearEnd = new Date(year,11,31,23,59,59).getTime();
		var range = IDBKeyRange.bound(yearBegin, yearEnd);
		posts.index('created').count(range).onsuccess = function(e) {
			console.log('Year '+year +' had '+e.target.result+ ' comments');
		};
	});


	/*
	unique threads, but only w/ posts
	*/
	var threads = [];
	posts.index('thread').openCursor(null,'nextunique').onsuccess = function(e) {
		var cursor = e.target.result;
		if(cursor) {
			//console.log('item', cursor.value.id, cursor.value.author.name);
			threads.push(cursor.value.thread);
			cursor.continue();
		} else {
			console.log(threads.length + ' total threads');
			doThreadStats(threads);
		}
	}

}

function doAuthorStats(authors) {
	console.log('doAuthorStats');

	//lame setup to handle knowing when we're done with the count, since its async and we don't have promises
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
		for(var i=0;i<10;i++) {
			console.log(authorInfo[i].author.name + ' with '+authorInfo[i].count + ' comments.');
		}
	}

}

function doThreadStats(threads) {
	console.log('doThreadStats');

	threads.sort(function(a,b) {
		if(a.posts > b.posts) return -1;
		if(a.posts < b.posts) return 1;
		return 0;
	});
	for(var i=0;i<10;i++) {
		console.log(threads[i].title + ' ('+threads[i].link+') with '+threads[i].posts + ' comments.');
	}

}
//hidden method to nuke the db
function killme(str) {
	window.indexedDB.deleteDatabase(str);
}