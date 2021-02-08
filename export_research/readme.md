The purpose of this directory is to support my effort to turn my Disqus comment data into flat HTML
I can import into my blog. My current thinking is something like this:

* Get the data
* Render out one page per 'thread', where a thread is a blog post
* Move this data to my blog into a folder such that a blog post template can import it
  
The following is done so far:

* getData.js: Given a forum name, this will output FORUM_rawdata.json. This is an array of posts.
* convertToThreads.js: Reads in the previous output and restructures to an array of threads where each thread has an array of posts. The embedded thread data is removed from the post.
  

