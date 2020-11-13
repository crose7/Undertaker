# Undertaker
NodeJS backup utility for the Kinja platform

## Command Line Use
### Jargon  
**Article:**        The abstract concept of a post.  
**Article index:**  The table of contents of a blogpage or userpage.  
**Content:**        The actual data of a post, comment, or image  
### Creating an archive index  
Undertaker will walk the entire length of the of the supplied URL and create an index, 100 articles at a time.  
This should finish within seconds for most userpages, but may take several minutes or even hours for blogs.  
```
$Undertaker node Undertaker.js <archive name> <kinja blog url>
$Undertaker node Undertaker.js example https://exampleblog.kinja.com
$Undertaker node Undertaker.js myUserPage https://kinja.com/myusername
```
If you'd like to capture only a slice of the entire index, you may pass the `--startDate <date>` and `--endDate <date>` flags:
```
$Undertaker node Undertaker.js example https://exampleblog.kinja.com --startDate "7/1/2020" --endDate "6/1/2019"
```
*this functionality is not available for userpages.
### Updating an archive index
Though userblogs will soon be sundered, for a brief remaining moment they will have new articles added to them.  
To capture these new articles, you must first update the article index:
```
$Undertaker node Undertaker.js <archive name> --update
$Undertaker node Undertaker.js example --update
```
*updating a time-sliced index is not recommended

### Downloading content

Once you have created an index, you can start downloading content. Undertaker provides two different methods:  
Articles only (--download): The quicker of the two, downloads articles content in batches of 100.  
Articles + comments (--comments): One hundred times slower, but downloads every single comment.  

```
$Undertaker node Undertaker.js example --download
$Undertaker node Undertaker.js example --comments
```
In the event that Undertaker fails to download content, simply re-run the command. Undertaker will attempt to download any undownloaded content. Please be aware that if an article is removed from a blog, because it remains in the article index, Undertaker will always attempt to download it, always fail gracefully, and continue to download any remaining content.
```
$Undertaker node Undertaker.js example2 https://exampleblog.kinja.com
```

### Downloading images

Once downloaded article content has been downloaded, you may optionally choose to download images as well. Be aware that this may take a **significant** amount of bandwidth storage and storage space. You may combine the download flags (--download, --comments) with the image flag (--images) to download images immediately, or choose to download images after the fact.

```
$Undertaker node Undertaker.js example --download --images
$Undertaker node Undertaker.js example --comments --images
$Undertaker node Undertaker.js example --images
```

### General Usage
Download everything in one go:  
```$Undertaker node Undertaker.js myStuff https://kinja.com/myusername --comments --images```  
Alternately, you can take it step by step:
```
$Undertaker node Undertaker.js myStuff 
$Undertaker node Undertaker.js myStuff --comments
$Undertaker node Undertaker.js mystuff --images
```

### Q & A
Q: Is there any chance this will harm my computer?  
A: You're right to be wary of executing unknown scripts; if you're not comfortable with running Undertaker, __*don't run it*__. That said, Undertaker *never* deletes files, but it does create them, so make sure it's tucked in a folder of its own so that it never writes files where it shouldn't.  

Q: It's taking forever to finish run! What gives?  
A: Some blogs are very large! A blog of 50,000 articles might take well over 10 minutes just to index!  

Q: I'm done waiting. I'm going to force-quit Undertaker.  
A: If you do, you'll have duplicate content and bloated filesizes, and may even corrupt your data.

Q: Oh no! I did that! What should I do?  
A: Create a new archive; you may save yourself some time by copying the archive index file `articleList` to new folder, then using that folder's name as the name of your new archive.

Q: Undertaker keeps showing errors! What went wrong?  
A: Each error should have a description of just what went wrong, but Undertaker probably just failed to download content. You can try again by repeating the command you just used.  

Q: I tried that, but it keeps happening!  
A: Disabling IP Flood Protection on my router seemed to help with this, and improved my web-browsing in general. That said, I'm a little wary of recommending that people turn off something that purportedly protects them, so please use caution here.  

Q: Did that too, still, no luck.  
A: It may be that the posts you are requesting no longer exist! Try navigating to `https://<any valid blog name>.kinja.com/<articleID>` - Kinja will automatically navigate to the proper blog, even if the post itself doesn't exist.  
  
Q: Okay, I tried that, and the post isn't there. Now what?  
A: Now you still have a backup of every other article listed in the article index.

Q: Is my data corrupted?  
A: No. So long as Undertaker completed running without being force-stopped, any data you downloaded is fine.  

Q: Okay. Now that I've downloaded all of these articles, how can I read them?  
A: As of this writing, the stored article content is not human readable.  

Q: What if I want to try my hand at transcribing it myself?  
A: First, remember you *only truly have a backup if you have a copy on a different storage device*, so be sure back up your backup. Second, you can take a peek at ArchiveManager.js, whose `each` routine behaves as you might expect.  

Q: I have no idea what's going on in ArchiveManager.js  
A: Don't sweat it. I'll get to work on a script that translates article content into markdown in time, but the clock's ticking on archiving.
