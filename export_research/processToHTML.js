/*
I read in the thread-centered data and then output rendered html for each thread.

notes for later - comment examples i like:
	https://css-tricks.com/how-to-add-commas-between-a-list-of-items-dynamically-with-css/
	
*/

const fs = require('fs');

const INPUT = './raymondcamden_threaddata.json';
const OUTPUT_DIR = './output/';

let threads = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// TEMP
threads = threads.slice(0,50);

console.log(`Working with ${threads.length} threads.`);

threads.forEach(t => {
	//console.log(t.link+' '+t.posts.length);
	let filename = OUTPUT_DIR + generateFileName(t);
	let content = generateContent(t.posts);
	// ensure directory exists
	let dir = filename.split('/');
	dir.pop();
	dir = dir.join('/');
	fs.mkdirSync(dir, { recursive:true });
	fs.writeFileSync(filename, content, 'utf-8');
});
console.log('Complete.');

/*
given a thread, determine a strategy for generating a file name. for me, this was
based on the url, minus the host
*/
function generateFileName(t) {
	return t.link.replace('http://www.raymondcamden.com/','') + '.html';
}

/*
Given an array of posts, generate an HTML string. 
*/
function generateContent(posts) {
	let html = '';
	posts.forEach((p,idx) => {
		let parentText = '';
		if(p.parent) { 
			let parentNumber = posts.findIndex(post => post.id == p.parent);
			//console.log('parentNumber', parentNumber);
			/*
			console.log('PARENT', p.parent);
			console.log(JSON.stringify(p, null, '\t'));
			*/
			parentText = `<span class="comment_parent_link">In reply to <a href="#c_${p.parent}">#${parentNumber+1}</a></span>`;
		}
		html += `
<div class="comment" id="c_${p.id}">
<img src="${p.author.avatar.small.permalink}" class="comment_author_profile_pic">
<span class="comment_number">${idx+1}</span>
<span class="comment_author">${p.author.name}</span>
<span class="comment_date">Posted on ${dateFormat(p.createdAt)}</span>
${parentText}
<div class="comment_text">${p.message}</div>
</div>
		`;
	});

	return html;
}

function dateFormat(d) {
	d = new Date(d);
	return new Intl.DateTimeFormat().format(d) + ' at ' + new Intl.DateTimeFormat('en-US', {hour:'numeric',minute:'2-digit'}).format(d);
}