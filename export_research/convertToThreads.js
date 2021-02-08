/*

I take the export of getData.js and convert it such that we have an array of thread objects which 
then contain an array of posts. I remove the .thread key from posts to make it smaller.

*/

const fs = require('fs');

const INPUT = './raymondcamden_rawdata.json';
const OUTPUT = './raymondcamden_threaddata.json';

console.log(`Reading ${INPUT}`);
let rawdata = fs.readFileSync(INPUT, 'utf-8');
let data = JSON.parse(rawdata);

let threads = [];

data.forEach(p => {
	index = threads.findIndex(t => t.id === p.thread.id);
	if(index === -1) {
		threads.push(p.thread);
		delete p.thread;
		index = threads.length-1;
		threads[index].posts = [];
	}
	threads[index].posts.push(p);
});

console.log(`Converted to a thread object of size ${threads.length}`);
fs.writeFileSync(OUTPUT, JSON.stringify(threads), 'utf-8');
console.log(`Result saved to ${OUTPUT}`);
