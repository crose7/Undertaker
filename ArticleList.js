let cheerio =   require(`cheerio`)
let fetch   =   require(`node-fetch`)
let fs      =   require(`fs`)
let bson    =   require(`bson`)
let zlib    =   require(`zlib`)
// args 0 AND 1 ARE node AND script
let argURL  =   process.argv[2]

class ArticleList{
    constructor(args){
console.log(`ArticleList()`,args)

        if(args.update && (args.startTime || args.endTime) ){ throw(`ArticleList() update ARGUMENT CANNOT BE USED WITH startTime or endTime`) }
        // SET DEFAULT VALUES
        this.name           =   args.name
        this.fileURL        =   `${this.name}/ArticleList`
        if(args.clear){ fs.writeFileSync( this.fileURL, JSON.stringify({}) ) }
        this.type           =   args.type?args.type.toLowerCase():`blog`
        this.url            =   undefined
        this.interval       =   100

        this.data           =   []
        this.startTime      =   this.type===`blog`? new Date().getTime()     : 0
        this.endTime        =   this.type===`blog`? new Date(0).getTime()    : Infinity
        this.cursorTime     =   this.startTime
        this.update         =   false


        this.maxRetryAttempts=  10
        this.retryAttempts  =   0

        let f               =   {}

        if ( !this.name ){ console.error(`ArticleList() name argument required`); return }
        if ( !fs.existsSync( this.name ) ){ fs.mkdirSync( this.name )}
        if ( fs.existsSync( this.fileURL ) ){ f = JSON.parse( fs.readFileSync( this.fileURL ) ) }

// console.log(`ArticleList() FILE`,f,args.startTime,this.startTime)
        // READS STATE FROM FILE; args OVERRIDE STATE!
        // PRECEDENCE:
        // ARGS > FILES > DEFAULTS(THIS)
        for( let key in this ){ this[key] = args[key]!=undefined?  args[key]:  f[key]!=undefined?     f[key]:     this[key] }
        // if( this.update ){
        //     this[key] = args[key]!=undefined?  args[key]:  f[key]!=undefined?     f[key]:     this[key]
        //     this[key] = f[key]?
        // }
        // else{
        //     for( let key in this ){ this[key] = args[key]!=undefined?  args[key]:  f[key]!=undefined?     f[key]:     this[key] }
        // }
// console.log(`POST precedence`,this)
        // if( this.update ){
        //     this.startTime      =   this.type===`blog`?new Date(this.startTime).getTime():parseInt(this.startTime)
        //     this.endTime        =   this.type===`blog`?new Date(this.startTime).getTime():isFinite(this.endTime)?parseInt(this.endTime):this.endTime
        //     this.cursorTime     =   this.startTime
        // }
        // else{
            this.startTime      =   this.type===`blog`?new Date(this.startTime).getTime():parseInt(this.startTime)
            this.endTime        =   this.type===`blog`?new Date(this.endTime).getTime():isFinite(this.endTime)?parseInt(this.endTime):this.endTime
            this.cursorTime     =   this.startTime
        // }
// console.log(`POST convert`,this)

        if ( args.clear ){
            console.log(`ArticleList() !CLEAR`)
            this.data       =   []
            this.cursorTime =   this.startTime
        }
    }





    uniqueIDs(){
        let a           =   []
        let s           =   this.data.reduce( ( acc, item ) => acc.add(item), new Set() )
        s.forEach( id => a.push(id) )
        return a
    }




    async start(){ await this.fetchPage() }





    fetchPageEvaluation(x){
        if ( !this.update ){
            // endTime BECOMES null AND THE END OF A BLOG
            if ( this.type == `blog`){
                // console.log(`ArticleList fetchPageEvaluation() blog loop`,new Date(this.cursorTime), this.cursorTime > this.endTime )
                return this.cursorTime > this.endTime
            }
            if ( this.type == `user`){
                // console.log(`ArticleList fetchPageEvaluation() user loop`, this.cursorTime)
                return this.cursorTime != null
            }
        }else{
            if( this.type == `blog` ){
                return this.cursorTime > this.startTime
            }
            // BECAUSE WE DON'T USE ENDTIME,
            // WE LOOK FOR THE NEWEST id, THEN STOP
            // WARNING: IF DUPLICATE POSTS ARE POSSIBLE ON USER BLOGS,
            // THIS __MAY MISS DATA!__
            if( this.type == `user` ){
// console.log(`ArticleList fetchPageEvaluation()`,this.data[0],x[0],( !x.some(item=>item==this.data[0]) ))
                return !( x.some(item=>item==this.data[0]) )
            }
        }
    }





    async fetchPage(){
console.log(`ArticleList fetchPage()`)

        let dataRef

        if (this.update){
            dataRef         =   []
            this.cursorTime =   this.type==`blog`?new Date().getTime():0
            // this.cursorTime =   this.type==`blog`?this.startTime:0
        }else{
            this.cursorTime =   this.startTime
            dataRef         =   this.data
        }

        while( this.fetchPageEvaluation(dataRef) ){
            if(this.retryAttempts >= this.maxRetryAttempts){throw(`ArticleList FETCH FAILED 10 TIMES CONSEQUTIVELY; ( ${this.url} ) LIKELY INVALID URL`)}
            let forceLoop   =   false
            let queryString =   this.type == `blog`? `${this.url}/?maxReturned=${this.interval}&startTime=${this.cursorTime}` : `${this.url}?maxReturned=${this.interval}&startIndex=${this.cursorTime}`
console.log(`ArticleList fetchPage() while`, this.cursorTime, new Date(this.cursorTime), queryString)

            let r           =   await fetch(queryString).catch(err=>{console.error(err); forceLoop=true})
            if (forceLoop){ console.log(`ArticleList fetchPage() FORCE LOOP`); this.retryAttempts++; continue; }
            else{ this.retryAttempts=0; }

                r           =   await r.text()
            let page        =   cheerio.load(r)
            let ids         =   page(`article[data-id]`).map( ( i, x ) => parseInt(cheerio(x).attr(`data-id`)) ).get()
            page(`article[data-id]`).each( ( i, x ) => {
                let id      =  parseInt(cheerio(x).attr(`data-id`))
                dataRef.push( id )
            })

            if ( !this.update || 1){
                if( this.type == `blog` ){
                    let _cursor         =   page(`a[href*="?startTime"]`).attr(`href`)
                        _cursor         =   _cursor? parseInt( _cursor.split(`=`)[1] ) : null
                    this.cursorTime     =   _cursor
                }

                if( this.type == `user` ){
                    let _cursor         =   page(`a[href*="?startIndex"]`).attr(`href`)
                    this.cursorTime     =  _cursor? ( this.interval + this.cursorTime ) : null
                }
            }
        }

        if( this.update ){
            console.log(`ArticleList fetchPage PRE finish`,dataRef.length,this.data.length)
            this.finishUpdate(dataRef)
        }
        else{
            console.log(`ArticleList fetchPage PRE finish`,dataRef.length,this.data.length)
            this.data           =   dataRef
            this.writeToFile()
        }

        // console.log(`stats`,this.idSet().size,this.data.length)
    }



    finishUpdate( newData ){
console.log(`ArticleList finishUpdate()`)
        let firstID         =   this.data[0]

        let cutoffPoint     =   newData.reduce( (acc,item,i) => {
            console.log(i,item,firstID)
            return item === firstID? i:acc
        },undefined)

        let trimmedNewData  =   newData.slice(0,cutoffPoint)
console.log(firstID, cutoffPoint, newData.length,trimmedNewData.length)
console.log( this.data.length + trimmedNewData.length )

        this.data           =   trimmedNewData.concat( this.data )
console.log( this.data.length )
        this.startTime      =   new Date().getTime()
        this.writeToFile()
    }



    async writeToFile(){
        console.log(`ArticleList writeToFile()`)
        this.update         =   undefined
        // this.clear          =   undefined
        fs.writeFileSync( this.fileURL, JSON.stringify(this) )
    }



    idSet(){
        return this.data.reduce( ( acc, x ) => acc.add( x ), new Set() )
    }

}



module.exports={
    ArticleList:ArticleList
}
function main(){
    let x = new ArticleList({
        name:       `taytest`,
        url:        `https://tay.kinja.com`,
        startTime:  new Date(`9/1/2020`).getTime(),
        endTime:    new Date(`8/1/2020`).getTime(),
        type:       `blog`,
        update:     true,
        // clear:true,
        // name:       `userTest`,
        // startTime:  180,
        // url:        `https://kinja.com/dilkokoro`,
        // type:       `user`,
        // // clear:true,
        // // update:true,
    })
}
// main()
console.log(`ArticleList Imported`)
