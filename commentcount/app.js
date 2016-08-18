var $forum, $startCount, $results;
var key = 'XrkXWYcSYFsQC74AMA9J37tNXuWbw0PwRl2DZSx3LHfu3pMJMio8Gts9qUAMBAV5';

$(document).ready(function() {

	$forum = $('#forum');
	$startCount = $('#startCount');	
	$results = $('#results');
	$startCount.on('click', doCount);
});

function doCount() {
	var forum = $forum.val();
	if($.trim(forum) === '') return;
	console.log('search for '+forum);
	$startCount.attr('disabled','disabled');
	$results.html('<p><i>Working on getting your stuff.</i></p>');

	doProcess(function(data) {
		console.log('back from doProcess');
		console.dir(data);
		var total = data.reduce(function(a,b) {
			return a + b.posts;
		},0);

		console.log('we had '+data.length +' threads');
		console.log('total comments = '+total);
		var avg = (total/data.length).toPrecision(3);
		$startCount.removeAttr('disabled');
		$results.html
			('<p>Total number of threads: '+data.length+'<br/>Total number of comments: '+total+'<br/>Average # of comments per thread: '+avg+'</p>'
		);
	}, forum);
}

function doProcess(cb, forum, cursor, threads) {
	console.log('running doProcess');
	var url = 'https://disqus.com/api/3.0/forums/listThreads.json?forum='+encodeURIComponent(forum)+'&api_key='+key+'&limit=100';
	if(cursor) url += '&cursor='+cursor;
	if(!threads) threads = [];
	$.get(url).then(function(res) {
		res.response.forEach(function(t) {
			threads.push(t);
		});

		if(res.cursor && res.cursor.hasNext) {
			doProcess(cb, forum, res.cursor.next, threads);
		} else {
			cb(threads);
		}
	},'json');
}