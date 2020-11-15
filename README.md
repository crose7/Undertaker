# Undertaker
NodeJS backup utility for the Kinja platform

## Installation

Download **NPM** and **Node** here: https://www.npmjs.com/get-npm  
Information about installing **Git** can be found here: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git  
You can check if you already have these installed by running these commands at the command line: `npm`, `node`, `git`.

### GIT Method (Easy! Recommended!)
1) Open the command line
2) Navigate to the folder of your choice
3) Run the command `git clone https://github.com/crose7/Undertaker` — this will install the base files.
4) Navigate to the newly created Undertaker folder
5) Run the command `npm install` — this will download the libraries that Undertaker requires to function. 

### Installing by hand (Tedious in the long run!)
1) Download a zip of this repo, then extract it.
2) Open the command line
3) Navigate to the folder you just extracted
4) Run the command `npm install`

## Updating Undertaker  
Undertaker is in rapid development. Too ensure that you recieve the benefits of these added features, take the following steps:  
### GIT Method
Navigate to your Undertaker folder in the command line and run `git pull`  

### By hand  
Download a zip of the repo, extract the files, drag those files into your pre-existing directory and overwrite the old ones.


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

### Downloading content

Once you have created an index, you can start downloading content. Undertaker provides two different methods:  
Articles only (--download): The quicker of the two, downloads articles content in batches of 100.  
Articles + comments (--comments): *One hundred times slower,* but also downloads every single comment.  

```
$Undertaker node Undertaker.js example --download
$Undertaker node Undertaker.js example --comments
```
In the event that Undertaker fails to download content, simply re-run the command. Undertaker will attempt to download any undownloaded content. Please be aware that if an article is removed from a blog, because it remains in the article index, Undertaker will always attempt to download it, always fail gracefully, and continue to download any remaining content.

### Downloading images

Once downloaded article content has been downloaded with `--download` or `comments` flags, you may optionally choose to download images as well. Be aware that this may take a **significant** amount of bandwidth and storage space. Use `--images` to download article images, and `--commentImages` if you also wish to download images for comments.

```
$Undertaker node Undertaker.js example --download --images  // works
$Undertaker node Undertaker.js example --comments --images  // also works
$Undertaker node Undertaker.js example --download --commentImages //does NOT work — comments not downloaded!
```

### Updating an archive index
Though userblogs will soon be sundered, for a brief remaining moment they will have new articles added to them.  
To capture these new articles, you must first update the article index. You will then need to download the new content:
```
$Undertaker node Undertaker.js <archive name> --update
$Undertaker node Undertaker.js example --update     // updated, but articles not downloaded
$Undertaker node Undertaker.js example --download   // downloaded articles
```
One and done:
```$Undertaker node Undertaker.js example --update --download```
*updating a time-sliced index is not recommended

### Checking the status of your archives
```
$Undertaker node Undertaker.js example --status
```
(More on the way!)


### General Usage Examples
Download absolutely everything in one go:  
```$Undertaker node Undertaker.js myStuff https://kinja.com/myusername --download --comments --images --commmentImages```
Download only articles and images:  
```$Undertaker node Undertaker.js myStuff https://kinja.com/myusername --download --images```

Take it step by step:
```
$Undertaker node Undertaker.js myStuff https://kinja.com/myusername
$Undertaker node Undertaker.js myStuff --download
```
Some time passes, and you decide you want to download images and comments:
```
$Undertaker node Undertaker.js myStuff --download --comments --images --update  // time passed! remember to update!
```

### Q & A
Q: Is there any chance this will harm my computer?  
A: You're right to be wary of executing unknown scripts; if you're not comfortable with running Undertaker, __*don't run it*__. That said, Undertaker *never* deletes files, but it does create them, so make sure it's tucked in a folder of its own so that it never writes files where it shouldn't.  

Q: It's taking forever to finish run! What gives?  
A: Some blogs are very large! A blog of 50,000 articles might take well over 10 minutes just to index!  

Q: I've decided I want to stop Undertaker, what should I do?
A: You can force-kill the process with CONTROL+C.

Q: Undertaker hasn't done anything for a while, what should I do?
A: If Undertaker is hanging, *wait 20 seconds*, then force-kill the process with CONTROL+C. Waiting helps ensure that Undertaker has saved its progress.

Q: How can I check if my data was successfully downloaded?
A: Undertaker reports downloads as they happen and also returns a tally upon completion. To check on the status of your archive after the fact, use the `--status` flag.

Q: Undertaker keeps showing errors! What went wrong?  
A: Each error should have a description of just what went wrong, but Undertaker probably just failed to download content. You can try again by repeating the command you just used.  

Q: I tried that, but it keeps happening!  
A: Disabling IP Flood Protection on my router seemed to help with this, and improved my web-browsing in general. That said, I'm a little wary of recommending that people turn off something that purportedly protects them, so please use caution here.  

Q: Did that too, still, no luck.  
A: It may be that the posts you are requesting no longer exist! Try navigating to `https://<any valid blog name>.kinja.com/<articleID>` - Kinja will automatically navigate to the proper blog, even if the post itself doesn't exist.  
  
Q: Okay, I tried that, and the post isn't there. Now what?  
A: In testing, I've happen upon an occasion where the `--download` flag downloaded a post that `--comments` could not. If it's feasible to, you might try using both `--download` and `--comment` flags. On the brought side, you still have a backup of every other article listed in the article index!

Q: Is my data corrupted?  
A: Try the `--status` command; if that runs without error you should be good.

Q: Okay. Now that I've downloaded all of these articles, how can I read them?  
A: As of this writing, the stored article content is not human readable.

Q: What if I want to try my hand at transcribing it myself?  
A: First, remember you *only truly have a backup if you have a copy on a different storage device*, so be sure back up your backup. Second, you can take a peek at ArchiveManager.js, whose `each` routine behaves as you might expect.  

Q: I have no idea what's going on in ArchiveManager.js  
A: Don't sweat it. I'll get to work on a script that translates article content into markdown in time, but the clock's ticking on archiving.
