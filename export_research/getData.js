/*
Part 1. Get a raw set of data that later scripts will make better. But for now, just download.
Result will be one huge array of posts. Each post object has a thread object.
*/

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');

// change this to your site
const FORUM = 'raymondcamden';
const KEY = process.env.KEY;
/* 
hard coded export, could be an arg, keeping it simple for now, slightly dynamic
as I add the forum name, which I believe is always filename safe
*/
const FILENAME = 'rawdata.json';

(async () => {
	console.log(`Fetching threads for ${FORUM}`);
	let posts = await getPosts(FORUM);
	console.log(`Done fetching posts, total is ${posts.length}`);
	let exportFile = FORUM + '_' + FILENAME;
	fs.writeFileSync(exportFile, JSON.stringify(posts), 'utf-8');
	console.log(`Data written to ${exportFile}`);
	// temp
	posts.forEach(p => {
		if(p.isDeleted) {
			console.log('DELETED POST', p);
		}
	});
})();

async function getPosts(forum, cursor, posts) {

	let url = `https://disqus.com/api/3.0/posts/list.json?forum=${encodeURIComponent(forum)}&api_key=${KEY}&limit=100&order=asc&related=thread`;
	if(cursor) url += '&cursor='+cursor;
	if(!posts) posts = [];

	let resp = await fetch(url);
	let data = await resp.json();
	let newPosts = data.response;
	newPosts.forEach(p => posts.push(p));
	// only one per K
	if(posts.length % 1000 === 0) console.log('Post total is now '+posts.length);

	if(data.cursor && data.cursor.hasNext) {
		return getPosts(forum, data.cursor.next, posts);
	} else return posts;
}

