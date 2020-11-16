// https://i.kinja-img.com/gawker-media/image/upload/upyhfwirll7qvca8voq6.jpg
//node Undertaker.js --create test --endTime "1/1/2018" --startTime "1/1/2019" --type "blog" --url https://tay.kinja.com
// node Undertaker.js --create usertest --startTime "300" --type "blog" --url https://kinja.com/shadowhakenw00

let fetch                   =   require(`node-fetch`)
let fs                      =   require(`fs`)
let bson                    =   require(`bson`)
let zlib                    =   require(`zlib`)
const {promisify}           =   require(`util`)
let writeFilePromise        =   promisify(fs.writeFile)//LATE GAME ADDITION

let TaskQueue               =   require(`./TaskQueue.js`).TaskQueue
let TaskItem                =   require(`./TaskQueue.js`).TaskItem
let ArticleList             =   require(`./ArticleList.js`).ArticleList
let ArchiveManager          =   require(`./ArchiveManager.js`).ArchiveManager



let Undertaker              =   class{
    constructor(args){
        this._downloadEnabled=false
        console.log(`Undertaker()`,args,process.argv, !args && (process.argv.length===1))

        if( !(args || (process.argv.length>=1)) ){ throw("args AND argv UNDEFINED!")}
        this.args           =   args

        this.nameIndex      =   2
        this.name           =   args?args.name:process.argv[this.nameIndex]

        // POST IDS
        // UNIQUE FROM articleList, BUT IS UPDATED WITH NEW ENTRIES FROM AN articleLIST
        this.uniqueIDMap    =  this.loadUniqueIDMap()
        // OTHER IDS
        this.authorIDSet    =   new Set()
        this.blogIDSet      =   new Set()
        this.linkIDSet      =   new Set()

        this.errors         =   []

        this.numPostDownloads       =   0
        this.numCommentDownloads    =   0
        this.numArticleDownloads    =   0
        this.numDownloadErrors      =   0
        this.numImageDownloads      =   0
        this.numCommmentImageDownloads= 0

        this.update         =   process.argv.some(x=>x===`--update`)        ||  ( args?args.update:0 )
        this.download       =   process.argv.some(x=>x===`--download`)      ||  ( args?args.download:0 )
        this.comments       =   process.argv.some(x=>x===`--comments`)      ||  ( args?args.comments:0 )
        this.images         =   process.argv.some(x=>x===`--images`)        ||  ( args?args.images:0 )
        this.commentImages  =   process.argv.some(x=>x===`--commentImages`) ||  ( args?args.commentImages:0 )
        this._status         =   process.argv.some(x=>x===`--status`)       ||  ( args?args.status:0 )
        this._logPosts      =   process.argv.some(x=>x===`--logPosts`)      ||  ( args?args.logPosts:0 )
        this._logAuthors    =   process.argv.some(x=>x===`--logAuthors`)   ||  ( args?args.logAuthors:0 )
        this._logArticles    =   process.argv.some(x=>x===`--logArticles`)  ||  ( args?args.logArticles:0 )
        if( this._status )      { this.status(); return; }
        if( this._logPosts )    { this.logPosts(); return; }
        if( this._logAuthors )  { this.logAuthors(); return; }
        if( this._logArticles )  { this.logArticles(); return; }
        args?0:this.start()
    }

    logPosts(){
        if( fs.existsSync(`${this.name}/posts.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/posts.gz`,()=>{})
            am.each(x=>{
                console.log(`id: ${x.id}\tauthorID:${x.authorId}\tdate: ${new Date(x.publishTimeMillis)}\ttitle: ${x.headline}`)
            })
        }
    }

    logArticles(){
        if( fs.existsSync(`${this.name}/articles.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/articles.gz`,()=>{})
            am.each(x=>{
                console.log(`id: ${x.id}\tauthorID:${x.authorId}\tdate: ${new Date(x.publishTimeMillis)}\ttitle: ${x.headline}`)
            })
        }
    }

    logAuthors(){
        console.log(`LOG AUTHORS`)
        let authorArray     =   []
        if( fs.existsSync(`${this.name}/authors.gz`) && 1){
            console.log(`AUTHORS`)
            let am          =   new ArchiveManager(`${this.name}/authors.gz`,()=>{
                authorArray.sort( ( a, b ) => b.screenName>a.screenName?-1:1 ).forEach( author => console.log(`name: ${author.screenName}\t\t\tid: ${author.id}`) )
            })
            am.each( author => authorArray.push( author ) )
        }
        else if( fs.existsSync(`${this.name}/articles.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/articles.gz`,()=>{
                authorMap.forEach(val=>authorArray.push(val))
                authorArray.sort( ( a, b ) => b.screenName>a.screenName?-1:1 ).forEach( author => console.log(`name: ${author.screenName}\t\t\tid: ${author.id}`) )
            })
            let authorMap   =   new Map()
            am.each(x=>{
                if(x.authors){
                    x.authors.forEach(author=>{
                        if( !authorMap.get(author.id) ){ authorMap.set(author.id,author) }
                    })
                }
            })
        }
    }

    // uniqueIDMap FEATURES DOWNLOADED STATE FOR
    // post, comments, images
    // WHICH THEN GETS SAVED WHEN THE DOWNLOAD OPERATION COMPLETES
    // (BUT COULD BE MADE TO SAVE WHENEVER!)

    // WE CAN'T SAVE AS A MAP, SO WE HAVE TO CONVERT TO AND FRO
    saveUniqueIDMap(){
        let o           =   {}
        this.uniqueIDMap.forEach( ( value, key ) =>{
            o[key]      =   value
        })
        fs.writeFileSync(`${this.name}/uniqueIDs`,JSON.stringify(o))
    }
    loadUniqueIDMap(){
        let m               =   new Map()
        if( fs.existsSync(`${this.name}/uniqueIDs`) ){
            let r           =   JSON.parse( fs.readFileSync(`${this.name}/uniqueIDs`) )
            Object.entries(r).forEach( item => {
                // console.log(`LOADED ID`,item[0],item[1])
                m.set( parseInt(item[0]), item[1] )
            })
        }else{}
        return m
    }

    // ids COME FROM articleList,
    // BUT articleList _DOES NOT_ STORE THEIR STATE
    updateUniqueIDMap(){
        let articleList     =   new ArticleList({name:this.name})
        let uniqueIDs       =   articleList.uniqueIDs()
        let c=0
        uniqueIDs.forEach( id => {
            if( !this.uniqueIDMap.get(id) ){
                c++
                // console.log(`NEW ID!`,id)
                this.uniqueIDMap.set(id,{
                    post:false,
                    comments:false,
                    images:false,
                })
            }
        })
        console.log(`NEW IDS`,c)
    }

    // USED FOR authors, blogs, links
    async loadIDSet( url, key ){
console.log(`loadIDSet()`,url)
        let p               =   new Promise((res,rej)=>{
            let r           =   new Set()
            if ( !fs.existsSync(url) ){ console.log(`!EXISTS`); res(new Set()); return; }
            if( fs.readFileSync(url).length === 0 ){ res(new Set()); return; }

            let manager     =   new ArchiveManager( url, _=> {
                console.log(`loadID FIN`,url)
                res(r);
            })
console.log(`POST manager`)
            manager.each( item => r.add(item[key]) )
        })
        return p
    }




    async status(){
        console.log(this.name)
        let articleList         =   new ArticleList( {name:this.name} )
        // await articleList.start()
        await this.updateUniqueIDMap()
        let x={
            posts:0,
            totalPosts:0,
            replyCounts:0,
            images:0,
            totalImages:0,

            articles:0,
            totalArticles:0,
            articleImages:0,
            totalArticleImages:0,
            comments:0,

            commentImages:0,
            totalCommentImages:0,

        }
        if( fs.existsSync(`${this.name}/posts.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/posts.gz`,()=>{
                console.log(`POSTS:\t\t\t${x.posts}/${this.uniqueIDMap.size}\t${x.replyCounts} comments exist`)
                console.log(`POSTS IMAGES:\t\t${x.images}/${x.totalImages}`)
            })
            am.each(item=>{
                x.posts++
                x.replyCounts+=item.replyCount
                recurse(item.body,`posts`)
            })
        }

        if( fs.existsSync(`${this.name}/articles.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/articles.gz`,()=>{
                console.log(`ARTICLES:\t\t${x.articles}/${this.uniqueIDMap.size}`)
                console.log(`ARTICLE IMAGES:\t\t${x.articleImages}/${x.totalArticleImages}`)
            })
            am.each(item=>{
                x.articles++
                recurse(item.body,`articles`)
            })
        }

        if( fs.existsSync(`${this.name}/comments.gz`) ){
            let am          =   new ArchiveManager(`${this.name}/comments.gz`,()=>{
                console.log(`ARTICLES:\t\t${x.articles}/${this.uniqueIDMap.size}\t${x.comments} DOWNLOADED comments`)
                console.log(`COMMENT IMAGES:\t\t${x.commentImages}/${x.totalCommentImages}`)
            })
            am.each(item=>{
                x.comments+=item.length
                item.forEach(comment=>recurse(comment.body,`comments`))
            })
        }

        if( fs.existsSync(`${this.name}/images`) ){ x.images        =   fs.readdirSync(`${this.name}/images`).length }
        if( fs.existsSync(`${this.name}/commentImages`) ){ x.commentImages =   fs.readdirSync(`${this.name}/commentImages`).length }

        function recurse(y,ctx){
            // let tabSTR      =   new Array(d).fill(`\t`).toString().replace(/,/g,``);
            if(y.type == `Image`){
                switch(ctx){
                    case `posts`:
                        x.totalImages++
                        break
                    case `articles`:
                        x.totalArticleImages++
                        break
                    case `comments`:
                        x.totalCommentImages++
                        break
                    default:
                }
            }
            if(typeof y === 'object'){
                for(let i in y){
                    let item    =   y[i]
                    recurse(item,ctx)
                }
            }else{}
        }
    }





    async start(_args){
console.log(`start()`)
        let args            =   _args?_args:this.args

        // LOAD THE ids WE'VE ALREADY DOWNLOADED
        this.authorIDSet    =   await this.loadIDSet(`${this.name}/authors.gz`,`id`)
        this.blogIDSet      =   await this.loadIDSet(`${this.name}/blogs.gz`,`id`)
        this.linkIDSet      =   await this.loadIDSet(`${this.name}/links.gz`,`url`)
        // console.log(`SET`,this.authorIDSet)

console.log(`ARGV`,process.argv,args,this.name)

        // let name   =   process.argv[this.nameIndex]
        let name   =   args?args.name:process.argv[this.nameIndex]

        // DID WE MAKE AN articleList?
        // NO? MAKE ONE.
        // YES? UPDATE IT.



        if ( !fs.existsSync(`${this.name}/ArticleList`) ){
            console.log(`Undertaker start() create`)
            let url                 =   args?args.url:process.argv[this.nameIndex+1]
            let type                =   url.match(/https\:\/\/kinja.com\//)?`user`:`blog`

            let startTimeIndex      =   process.argv.findIndex(x=>x===`--startTime`)
            let endTimeIndex        =   process.argv.findIndex(x=>x===`--endTime`)
            let startTime
            let endTime
            if ( startTimeIndex !== -1 )   { startTime =   process.argv[startTimeIndex+1] }
            if ( endTimeIndex !== -1 )     { endTime   =   process.argv[endTimeIndex+1] }
console.log(`TIME`,startTime,endTime,startTimeIndex,endTimeIndex)

            let opts                =   {
                name                :   this.name,
                url                 :   url,
                type                :   type,
                startTime           :   startTime,
                endTime             :   endTime,
            }

            let articleList         =   new ArticleList( opts )
            await articleList.start()
            this.updateUniqueIDMap()
        }
        // else{
        if( this.update ){
console.log(`Undertaker start() update`)
            let startTimeIndex      =   process.argv.findIndex(x=>x==`--startTime`)
            let endTimeIndex        =   process.argv.findIndex(x=>x==`--endTime`)
            let startTime
            let endTime
            if ( startTimeIndex !== -1 )   { startTime =   process.argv[startTimeIndex+1] }
            if ( endTimeIndex !== -1 )     { endTime   =   process.argv[endTimeIndex+1] }

            let opts                =   {
                name                :   this.name,
                update              :   true,
                // startTime           :   startTime
            }
            let articleList         =   new ArticleList( opts )
            console.log(`Checking for posts...`)
            // if( !process.argv.some(x=>x===`--noUpdate`) ){ await articleList.start() }
            await articleList.start()
            console.log(`... done.`)
            // this.updateUniqueIDMap()
            // this.uniqueIDMap.forEach(x=>x.post=false)
            return
        }
        this.updateUniqueIDMap()





// console.log(`download`)
        this.articleList    =   new ArticleList({ name:this.name })

        let queueIDs        =   []
        let commentIDs      =   []

        // queueIDs = ids TO DOWNLOAD
        this.uniqueIDMap.forEach( ( value, key ) =>{
            if(value.post){return}
            queueIDs.push(key)
        })
        this.uniqueIDMap.forEach( ( value, key ) =>{
            if(value.comments){return}
            commentIDs.push(key)
        })

        let queueIDCount    =   queueIDs.length
        let commentIDCount  =   commentIDs.length

    console.log(`Undertaker start() queueIDs`,queueIDs.length)
        let apiURL          =   `https://kinja.com/api/magma/post/views/id/?`
        let postOutput      =   this.download?fs.createWriteStream(`${this.name}/posts.gz`,   { flags: `a` } ):null
        let authorOutput    =   this.download?fs.createWriteStream(`${this.name}/authors.gz`, { flags: `a` } ):null
        let blogOutput      =   this.download?fs.createWriteStream(`${this.name}/blogs.gz`, { flags: `a` } ):null
        let linkOutput      =   this.download?fs.createWriteStream(`${this.name}/links.gz`, { flags: `a` } ):null
        let articleOutput   =   this.comments?fs.createWriteStream(`${this.name}/articles.gz`, { flags: `a` } ):null
        let commentOutput   =   this.comments?fs.createWriteStream(`${this.name}/comments.gz`, { flags: `a` } ):null

        let taskQueue       =   new TaskQueue(10, res =>{
            console.log(`Undertaker start() download taskQueue FINISH`)
            this.download?postOutput.end():0
            this.download?authorOutput.end():0
            this.download?blogOutput.end():0
            this.download?linkOutput.end():0

            this.comments?articleOutput.end():0
            this.comments?commentOutput.end():0
            //UPDATE UNIQUE ID LOG
            // console.log(`Undertaker start() TaskQueue PRE SAVE map\tuniqueIDs:${this.uniqueIDMap.size}\tarticleListLength:${this.articleList.data.length}`)
            console.log(`Undertaker start() TaskQueue FINISH\tdownloadedPosts:${this.numPostDownloads}/${queueIDCount}\tdownloadedArticles:${this.numArticleDownloads}/${commentIDCount}\tdownloadedComments:${this.numCommentDownloads}\tdownloadedImages:${this.numImageDownloads}`)
            if( (this.articleList.length===0) || (this.uniqueIDMap.size===0) ){ throw(`INVALID URL, ARCHIVE CORRUPTED: DELETE THIS ARCHIVE AND RETRY WITH A KINJA URL.`) }
            // let x = this.articleList.data.reduce( (acc,id) =>{
            //     if(!acc[id]){acc[id]=1}
            //     else{acc[id]+=1}
            //     return acc
            // },{})
            // console.log(`MISSED?`,Object.entries(x).filter(x=>x[1]>1))
            this.saveUniqueIDMap()
        })



        if( this.comments ){
            this.interval = setInterval(_=>this.saveUniqueIDMap(),10000)
            let c=0
            commentIDs.forEach( id =>{
                let startIndex  =   0
                taskQueue.addItem( new TaskItem(async _=>{
    // console.log(`NEW RUN FUNC`)
                    let fetching            =   true
                    let article
                    let comments            =   []
                    let loopCount           =   0
                    // let c=0
                    while ( fetching ){
                        c++
                        let halt            =   false
                        let queryString     =   `https://kinja.com/ajax/comments/views/flatReplies/${id}?startIndex=${startIndex}&maxReturned=100&approvedOnly=false&cache=true&sorting=oldest`
                        let r               =   await fetch( queryString ).catch( err => { console.error(`Undertaker start --comments TaskItem`,err); this.errors.push(err); halt=true } )
                        if( halt ){ return }
                            r               =   await r.json()
                        if( !r.data ){
                            console.error(`Undertaker start() --comments !NO_DATA`,r,id);
                            this.errors.push([`Undertaker start() --comments !NO_DATA`,r,id])
                            await sleep(10000)
                            return

                        }
                        article             =   r.data.items[0].reply
                        let children        =   r.data.items[0].children
// console.log(`Undertaker start() --comments while\t${this.numArticleDownloads}/${commentIDs.length}\tloops:${d}\tid:${id}\tstartIndex:${children.pagination.curr.startIndex}\ttotal:${children.pagination.curr.total}\titems:${children.items.length}\ttitle:${article.headline}`)
                        if ( children ){
                            // children.items.map( x => JSON.stringify(x) ).map( x => zlib.gzipSync(x) ).forEach( child => commentOutput.write(child) )
                            children.items.forEach(x=>comments.push(x))
                            this.numCommentDownloads+=children.items.length
                            fetching        =   !!children.pagination.next

                        }else{ fetching=false }
                        startIndex          +=  100
                        loopCount++
                    }

                    this.numArticleDownloads++
                    articleOutput.write( zlib.gzipSync( JSON.stringify(article) ) )
                    commentOutput.write( zlib.gzipSync( JSON.stringify(comments) ) )
                    // console.log(`Undertaker start() --comments TaskItem\t${this.numArticleDownloads}/${commentIDCount} articles`)
console.log(`Undertaker start() --comments while\t${this.numArticleDownloads}/${commentIDs.length}\tloops:${loopCount}\tid:${id}\tcomments:${comments.length}\ttitle:${article.headline}`)
                    this.uniqueIDMap.get(id).comments       =   true
                    this.saveUniqueIDMap()
                }))
            })
        }



        // THERE MAY HAVE BEEN A BETTER WAY TO PACK URLS INTO PACKS OF 100
        // BUT THIS IS WHAT I CAME UP WITH
        if( this.download ){
            while ( queueIDs.length ){
            // while ( 0 ){
                let queryString =   `${apiURL}`
                let slice       =   queueIDs.splice(0,100)  //SLICE MUTATES THE ORIGINAL ARRAY! :D

                slice.forEach( id => queryString +=  `&postId=${id}` )

                taskQueue.addItem( new TaskItem( async _=>{
                    // let halt    =   false
                    // let r       =   await fetch(queryString).catch(err=>{ console.error(`Undertaker start() --download TaskItem fetch`,err); this.errors.push(err); halt=true })
                    //     r       =   await r.json().catch(err=> { console.error(`Undertaker start() --download TaskItem json()`,err); this.errors.push(err); halt=true })
                    let r       =   await fetch(queryString).catch( err =>  { this.errors.push(err); throw(`Undertaker start() --download TaskItem fetch`,err) })
                        r       =   await r.json().catch(           err =>  { this.errors.push(err); throw(`Undertaker start() --download TaskItem json()`,err) })
                    // if( halt ){ return }

                    r.data.posts
                        .filter(    post => !this.uniqueIDMap.get(parseInt(post.id)).post )
                        .map(       post => [zlib.gzipSync( JSON.stringify(post) ),parseInt(post.id)] )
                        .forEach(   x    => {
                            postOutput.write(x[0])
                            this.uniqueIDMap.get(x[1]).post=true
                            this.numPostDownloads++
                        })
                    console.log(`Undertaker start() download TaskItem\t${this.numPostDownloads}/${queueIDCount} posts`)

                    // IF THE <author, blog, link> IS NEW, ADD IT, ELSE SKIP
                    Object.entries( r.data.authors ).forEach( x => x[1].forEach( data => {
                        if ( !this.authorIDSet.has( data.id ) ){
                            // console.log(data.id)
                            this.authorIDSet.add( data.id )
                            let y = zlib.gzipSync( JSON.stringify(data) )
                            authorOutput.write( y )
                        }
                    }) )

                    Object.entries( r.data.blogs ).forEach( x => x[1].forEach( data => {
                        if ( !this.blogIDSet.has( data.id ) ){
                            // console.log(data.id)
                            this.blogIDSet.add( data.id )
                            let y = zlib.gzipSync( JSON.stringify( data ) )
                            blogOutput.write( y )
                        }
                    }) )

                    Object.entries( r.data.links ).forEach( x => x[1].forEach( data => {
                        if ( !this.linkIDSet.has( data.url ) ){
                            // console.log(data.url)
                            // blogIDSet.add( data.url )    //WAS blogID FOR SOME REASON?
                            this.linkIDSet.add( data.url )
                            let y = zlib.gzipSync( JSON.stringify( data ) )
                            linkOutput.write( y )
                        }
                    }) )

                }) )

            console.log(`Undertaker start() --download\tRemaining queueIDs to prepare:${queueIDs.length}`)
            }
        }
        // TODO: ADD FAILED DOWNLOAD COUNT
console.log(`Undertaker start() Beginning content download`,this.args)
        await taskQueue.start()
console.log(`Undertaker start() Finished content download`)
        if( this.errors.length ){
            this.errors.forEach((x,i)=>console.log(`Error #${i}`,x))
            console.log(`${this.errors.length} errors, please review terminal output, and rerun command.`)
        }
        clearInterval(this.interval)





        // BEGIN IMAGE SECTION!
        let c=0
        let d=0
        let dlSize=0
        let dlInfo=[]
        let r=[]    // RECURSE USES THIS; YES IT'S GROSS, YES IT WORKS

        // if( args?args.images:this.images ){
        //
        // }

        if( this.images || this.commentImages ){
console.log(`Undertaker start() --images`)
            let articleImages           =   []
            let commentImages           =   []

            let postFileInfo            =   fs.existsSync(`${name}/posts.gz`)   ?   fs.statSync(`${name}/posts.gz`).size:0
            let articleFileInfo         =   fs.existsSync(`${name}/articles.gz`)?   fs.statSync(`${name}/articles.gz`).size:0
            if( ( postFileInfo === 0 ) && ( articleFileInfo === 0) ){ throw(`Undertaker start() --images NO CONTENT DOWNLOADED!`); return }
            let fileToScan              =   postFileInfo > articleFileInfo?     `posts` : `articles`
// console.log(`FILE TO SCAN`,fileToScan)

            // if( !fs.existsSync(`images`) ){ fs.mkdirSync(`images`) }
            if( !fs.existsSync(`${name}/images`) ){ fs.mkdirSync(`${name}/images`) }

            // let downloadedImagesSet     =   fs.readdirSync(`images`)
            let downloadedImagesSet     =   fs.readdirSync(`${name}/images`)
                downloadedImagesSet     =   downloadedImagesSet.reduce( (acc,x) => acc.add(x), new Set() )
            // let articleImages           =   r



            let postReader              =   new ArchiveManager(`${name}/${fileToScan}.gz`,async _=>{
                let undownloadedImages  =   articleImages.map( x => `${x.id}.${x.format}`).filter( x => !downloadedImagesSet.has(x) )
console.log(`Undertaker start() --images ArchiveManager postReader callback`,undownloadedImages.length)

                // TaskQueue ARE SET UP IN REVERSE:
                // THE SUPPLIED FUNCTION IS CALLED LAST
                let imageQueue          =   new TaskQueue(10,_=>console.log(`IMAGE QUEUE FINISH`))
                for(let i=0;i<undownloadedImages.length;i++){

                    let filename        =   undownloadedImages[i]

                    // TaskQueue CALLS TaskItem's RUN
                    // (TOO LATE IN DEVELOPMENT TO HAVE .addItem TAKE JUST A FUNCTION!)
                    // imageQueue.addItem( new TaskItem(async _=>{
                    //     // let info            =   await fetch(`https://i.kinja-img.com/gawker-media/image/upload/${filename}`,{method:`HEAD`})
                    //     //     dlSize          +=  parseInt(info.headers.get(`content-length`))
                    //     //     dlInfo.push([filename,parseInt(info.headers.get(`content-length`))])
                    //     //     console.log(`${dlSize}\t${filename}\t${parseInt(info.headers.get(`content-length`))}\t${i}\t${undownloadedImages.length}\t${filename}`)
                    //     // await sleep(1)
                    // }) )
                    if( this.images ){

                    imageQueue.addItem( new TaskItem( async ()=>{

                            // this.numImageDownloads++
                            // console.log(`Undertaker start() --images TaskItem\t${this.numImageDownloads}\t${undownloadedImages.length}\t${filename}`)
                            // return

                            let image           =   await fetch(`https://i.kinja-img.com/gawker-media/image/upload/${filename}`)
                                                    .catch(err=>{
                                                        console.error(`Undertaker start() --images post${err}`)
                                                        this.errors.push(`Undertaker start() --images post${err}`)
                                                        this.numDownloadErrors++
                                                    })
                                image           =   await image.arrayBuffer()
                                this.numImageDownloads++
                                console.log(`Undertaker start() --images TaskItem\t${this.numImageDownloads}/${undownloadedImages.length}\t${filename}\tsize:${image.byteLength}`)
                            writeFilePromise(`${name}/images/${filename}`,Buffer.from(image))
                            // writeFilePromise(`images/${filename}`,Buffer.from(image))
                        }))
                    }
                }
                console.log(`Undertaker start() --images imageQueue START`)
                await imageQueue.start()
                console.log(`Undertaker start() --images imageQueue FINISH\t${this.numImageDownloads}/${undownloadedImages.length}`)

                // NESTING THIS BECAUSE I SUCK AT promises
                if ( this.commentImages ){
                    if( !fs.existsSync(`${name}/commentImages`) ){ fs.mkdirSync(`${name}/commentImages`) }
                    console.log(`Undertaker start() --commentImages ArchiveManager postReader callback`,undownloadedImages.length)
                    if( !fs.existsSync(`${name}/comments.gz`) ){throw(`Undertaker start() --commentImages COMMENTS NOT DOWNLOADED!`)}
                    let commentReader               =       new ArchiveManager(`${name}/comments.gz`, async ()=>{

                        let undownloadedImages      =   commentImages.map( x => `${x.id}.${x.format}`).filter( x => !downloadedImagesSet.has(x) )
                        console.log(`Undertaker start() --commentImages ArchiveManager commentReader callback\tundownloadedImages:${undownloadedImages.length}`)

                        for( let i = 0; i < undownloadedImages.length; i++ ){

                            let filename            =       undownloadedImages[i]

                            imageQueue.addItem( new TaskItem( async ()=>{

                                // this.numCommmentImageDownloads++
                                // console.log(`Undertaker start() --commentImages TaskItem\t${this.numCommmentImageDownloads}\t${undownloadedImages.length}\t${filename}`)
                                // return
                                let image           =   await fetch(`https://i.kinja-img.com/gawker-media/image/upload/${filename}`)
                                                        .catch(err=>{
                                                            console.error(`Undertaker start() --commentImages post${err}`)
                                                            this.errors.push(`Undertaker start() --commentImages post${err}`)
                                                            this.numDownloadErrors++
                                                        })
                                image               =   await image.arrayBuffer()
                                this.numCommmentImageDownloads++
                                console.log(`Undertaker start() --commentImages TaskItem\t${this.numCommmentImageDownloads}/${undownloadedImages.length}\t${filename}\tsize:${image.byteLength}`)
                                writeFilePromise(`${name}/commentImages/${filename}`,Buffer.from(image))
                                // writeFilePromise(`commentImages/${filename}`,Buffer.from(image))
                                // let info            =   await fetch(`https://i.kinja-img.com/gawker-media/image/upload/${filename}`,{method:`HEAD`})
                                //     dlSize          +=  parseInt(info.headers.get(`content-length`))
                                //     dlInfo.push([filename,parseInt(info.headers.get(`content-length`))])
                                //     console.log(`${dlSize}\t${filename}\t${parseInt(info.headers.get(`content-length`))}`)
                            }))
                        }
                        console.log(`Undertaker start() --commentImages imageQueue START`)
                        await imageQueue.start()
                        console.log(`Undertaker start() --commentImages imageQueue FINISH\t${this.numCommmentImageDownloads}/${undownloadedImages.length}`)
                    })
                    commentReader.each( comments =>{
                        comments.forEach( comment => {
                            recurse(comment.body,commentImages)
                        })
                    })
                }else{console.warn(`COMMENTS NOT DOWNLOADED!`)}

                // START DOWNLOADING IMAGES
                // console.log(`Undertaker start() IMAGE QUEUE START`)
                // await imageQueue.start()
                // console.log(`Undertaker start() IMAGE QUEUE END`,parseInt(dlSize/1000000),dlInfo.sort( (a,b) =>b[1]-a[1] ))

            })
            // GET IMAGES, RUNS BEFORE imageQueue!
            postReader.each( post => recurse(post.body,articleImages) )
            // postReader.each( post => post )
            console.log(`Undertaker start() --images END`)
        }else{
            // console.log(`Undertaker start() --images NOT IMAGES`)
        }
console.log(`AFTER IMAGES`)


        //UTILITY FUNCITONS
        async function downloadFile(url, outputPath) {
            let r           =   await fetch(url)
                r           =   await r.arrayBuffer()
            writeFilePromise(outputPath,Buffer.from(r))
        }
        function recurse(x,ctx){
            let tabSTR      =   new Array(d).fill(`\t`).toString().replace(/,/g,``);
            d++
            c++
            if(x.type == `Image`){
                ctx.push(x)
                // console.log(x)
            }
            if(typeof x === 'object'){
                for(let i in x){
                    let item    =   x[i]
                    // console.log(`TYPE`,tabSTR+item.type)
                    recurse(item,ctx)
                }
            }else{
                // console.log(tabSTR+x)
            }
            d--
        }
        async function sleep(n){
            let p=new Promise( (res,rej)=>{
                setTimeout(_=>res(),n)
            })
            return p
        }
        // END UTIL

        return
    }
}
module.exports={
    Undertaker:Undertaker
}
process.argv.length>1?new Undertaker():0
