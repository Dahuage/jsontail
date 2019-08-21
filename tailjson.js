#!/usr/bin/env node

/**
 *
 * tail - output the last lines of file(s). This wheel is
 * inspired by GNU tail and npm tail by <Luca Grulla>.
 * Yet more, imatate this for learning.
 * @author dahua<guzhaoer@gmail.com>
 **/

const version = '0.0.1';

const fs = require('fs');
const events = require('events');
const stream = require('stream');
const commander = require('commander');
const colors = require('colors');

/**
 * Rarse options & argv.
 */
const DEFAULT_LINES = '10';
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const BUFF_SIZE = 1024;
const COPY_TO_EOF = Number.MAX_SAFE_INTEGER

const program = new commander.Command();
program.version(version);
program.option('-c,--count-bytes <number>', 'same as GUN tail');
program.option('-f,--forever', 'same as GUN tail');
program.option('-F,--Forever', 'same as GUN tail');
program.option('-q,--no-headers', 'same as GUN tail');
program.option('-s,--sleep-interval', 'same as GUN tail');
program.option('-r,--reverse-display', 'same as GUN tail');
program.option('-v, --verbose', 'same as GUN tail');
program.option('-z, --zero-terminated', 'same as GUN tail');
program.option('--max-unchanged-stats <number>', 'same as GUN tail');
program.option('--pid <number>', 'same as GUN tail');
program.option('-n,--lines <number>', 'same as GUN tail', DEFAULT_LINES);

program.option('-i --ignore', 'ignore error when parsing JSON');
program.option('-j --json', 'line in JSON format');
program.option('-b --breaks', 'breaks when hits a keyword');
program.option('-H --highlight <string>', 'highlight the line by a keyword');
program.on('--help', function(){
    console.log('');
    console.log('Examples:');
    console.log('  $ tailjson -h');
    console.log('  $ tailjson -n 10 /path/to/file');
});
program.parse(process.argv);
const options = program.opts();
const args = program.args;
if (!args.length && process.stdin.isTTY) {
    program.outputHelp((txt)=>{
        return colors.red(txt);
    });
    process.exit(EXIT_SUCCESS);
};

/**
 * Global things.
 */

// Options related to forever
const forever = options.forever || options.Forever;
const follow_name = forever ? (options.Forever ? false : true) : false;
const sleepInterval = options.sleepInterval || 0;
const pid = options.pid || null;
const maxUnchangedStats = options.maxUnchangedStats || 0;

// Options relates to temp
const countBytes = options.countBytes || 0;
const lines = options.lines || DEFAULT_LINES;
const lineMode = forever ? true : parseInt(countBytes) > 0 ? false : true;
const lineEnd = '\n';
const nUnit = parseInt(countBytes) || parseInt(lines);
const fromStart = (countBytes && countBytes.includes('+')) || (options.lines && options.lines.includes('+')) ? nUnit : 0;
const fromStdin = args.length === 0;

// Options relates to display
const reverseDisplay = options.reverseDisplay || false;
const noHeaders = options.noHeaders || true;
const verbose = options.verbose || false;
const filter = options.filter || '';
const json = options.json || false;
const ignore = options.ignore || true;

// Nonsense
if(!nUnit && !fromStart && !forever){
    process.exit(EXIT_SUCCESS);
}

/**
 * Tail's private method.
 */
const _private_method_init_inputs = Symbol('initInputs');
const _private_method_delivery = Symbol('delivery');
const _private_method_input_end = Symbol('inputEnd');

function parseJson(str){
    try{
        let obj = JSON.parse(str)
        let ret = JSON.stringify(obj, null, "\t")
        console.log(ret)
    }catch(e){
        console.log('------ERR PARSE------')
        console.log(e)
        console.log('------SOURCE------')
        console.log(str)
    }
}

class Tail {

    constructor(options, files=[]) {
        this.running = false;
        this.files = files;
        this.fileNum = files.length;
        this.inputs = null;

        this[_private_method_init_inputs]();
        this.output = new StreamWriter();
        this.trafficPolice = new events.EventEmitter();
        this.trafficPolice.on('delivery', this[_private_method_delivery]);
        this.trafficPolice.on('end', this[_private_method_input_end]);
    }

    [_private_method_delivery](e, data){
        this.output.write(data);
    }

    [_private_method_input_end](e, data){
        this.inputNum -= 1;
        if(this.inputNum === 0){
            // process.exit;
        }
    }

    [_private_method_init_inputs](){
        let inputs = new Set();
        for(let file of this.files){
            if(forever){
                // Need verify the input neither a tty nor a pipe or fifo.
                // just build a option logic and leave work 2 readstream.
            }else{
                //
            }
            inputs.add(new StreamReader(file));
        }
        this.inputs = inputs;
        this.inputNum = inputs.length;
    }

    run(){
        for(let input of this.inputs){
            input.tail();
        }
    }

}

class StreamWriter extends events.EventEmitter{
    
    constructor(controller){
        super()
        this.stdout = process.stdout;
        this.is_alive = true;
        this.to_pipe = false;
    }

    prettyJson(json){

    }

    highlight(line_or_raw){
        if(this.controller.filter){
            // Higlight the keyword
        }
    }

    write(data){
        if(this.controller.json){
            // Parse data as json and pretty it
        }
    }
    alive(){
        // Check this is alive when stdout is a pipe
    }

    warn(){
        // Warn sth maybe
    }
}

class StreamReader extends events.EventEmitter{
    constructor(file){
        super();
        this.fd = fs.openSync(file, 'r');
        let stat = fs.fstatSync(this.fd);
        this.filename = file;
        this.initFileSize = stat.size;
        this.mode = stat.mode;

        this.ignore = false;
        this.tailable = true;
        this.n_unchanged_stats = 0;

        this.proxy = null;
        this.watcher = null;
    }

    get header(){
        const name = this.name;
        const now = Date.now();
        return `${name}-${now}`;
    }

    _build_read_proxy(){
        let self = this;
        if(countBytes){
            this.proxy = new ByteReader(self);
        }else{
            this.proxy = new LineReader(self);
        }

        if(forever){
            this.watcher = new FileWatcher(self);
            this.watcher.on('data', (d)=>{parseJson(d)});
            this.watcher.on('eventB', ()=>{});
        }
        this.proxy.on('eventA', ()=>{});
        this.proxy.on('eventB', ()=>{});
    }

    tail(){
        this._build_read_proxy();
        this.proxy.tail();
        if(forever){
            this.watcher.watch();
        }
    }
}

class NonImplementError extends Error{

    constructor(){
        super();
    }
}

class ReaderDelegateBase extends events.EventEmitter{

    constructor(reader){
        super();
        this.reader = reader;
        this.internalDispatcher = new events.EventEmitter();
    }

    get fd(){return this.reader.fd;}
    get fileSize(){return this.reader.initFileSize;}
    get curPosition(){return this.reader.curPosition;}
    set curPosition(value){this.reader.curPosition = value;}

    /** abstract method. */
    tail(){
        throw new NonImplementError();
    }

    /**TODO let COPY_TO_EFO = file.initFileSize??? */
    dumps(readNum){
        const fd = this.fd;
        let buffer = Buffer.alloc(BUFF_SIZE);
        let remain = readNum;
        while(remain){
            readNum = Math.min(readNum, BUFF_SIZE);
            let readBytes = fs.readSync(fd, buffer, 0, readNum, this.curPosition);
            if(readBytes < readNum){
                /**Exausted */
                remain = 0;
            }else{
                remain -= readNum;
            }
            this.internalDispatcher.emit('data', buffer.slice(0, readBytes))
            this.curPosition += readBytes
        }
    }
}

class ByteReader extends ReaderDelegateBase{

    constructor(reader){
        super(reader);
        this.internalDispatcher.on('data', (data)=>{
            console.log(data.toString());
        })
    }
    tail(){
        if(fromStart){
            this.curPosition = nUnit;
        }else{
            let readPosi = this.fileSize - nUnit;
            this.curPosition = readPosi;
        }
        let readNum = COPY_TO_EOF;
        this.dumps(readNum);
    }
}

class LineReader extends ReaderDelegateBase{

    constructor(reader){
        super(reader);
        this.skipCounter = nUnit;
        this.dumpPosition = null;
        this.internalDispatcher.on('data', (data)=>{
            console.log(data.toString());
        })
    }

    /**
     * Offset n lines from start.
     */
    startLines(){
        const fd = this.fd;
        let posi = 0;
        let buffer = Buffer.alloc(BUFF_SIZE);
        let blocks = Math.ceil(this.fileSize / BUFF_SIZE);
        if(blocks === 0)return -1;
        do{
            let readBytes = fs.readSync(fd, buffer, 0, BUFF_SIZE, posi);
            if(readBytes === 0){
                return -1;
            }else if(readBytes > 0 && readBytes < BUFF_SIZE){
                // Exasted.
                buffer = buffer.slice(0, readBytes);
            }
            let start = 0;
            while(true){
                let lastLine = buffer.indexOf(lineEnd, start);
                if(lastLine >= 0){
                    start = lastLine + 1;
                    this.skipCounter -= 1;
                    /** +1 means skip the '\n' itself.*/
                    if(this.skipCounter === 0)return posi + lastLine + 1;
                    if(start >= BUFF_SIZE)break;
                    continue;
                }
                break;
            }
            posi += readBytes;
            blocks -= 1;
        }while(blocks > 0)
        return -1;
    }

    /**Offset n lines from the file end.*/
    fileLines(){
        const fd = this.fd;
        let posi = this.fileSize;
        let buffer = Buffer.alloc(BUFF_SIZE);
        let blocksSize = this.fileSize % BUFF_SIZE || BUFF_SIZE;
        let blocks = Math.ceil(this.fileSize / BUFF_SIZE);
        let isFisrtBlock = true;
        if(blocks === 0)return -1;

        do{
            posi -= blocksSize;
            let readBytes = fs.readSync(fd, buffer, 0, blocksSize, posi);
            if(readBytes !== blocksSize){
                throw Error('READ ERROR');
            }
            /**
             * Conter lines from the second.
            */
            let start = isFisrtBlock ? readBytes - 2 : readBytes;
            while(true){
                let lastLine = buffer.lastIndexOf(lineEnd, start);
                if(lastLine >= 0){
                    start = lastLine - 1;
                    this.skipCounter -= 1;
                    if(this.skipCounter === 0)return posi + lastLine + 1;
                    if(lastLine < 0)break;
                    continue;
                }
                break;
            }
            blocks -= 1;
            /**This is a little bit dummy. */
            if(isFisrtBlock){
                blocksSize = BUFF_SIZE;
                isFisrtBlock = false;
            }
        }while(blocks > 0)
        /** Just dumps all since there is no enougth lines*/
        return 0;
    }

    tail(){
        let startReadPosi;
        if(fromStart){
            startReadPosi = this.startLines();
            if(startReadPosi > this.reader.initFileSize){
                process.exit(EXIT_SUCCESS);
            }
        }else{
            startReadPosi = this.fileLines();
        }
        /**-1 means nothing in the file*/
        if(startReadPosi === -1)return;
        this.reader.curPosition = startReadPosi;
        this.dumps(COPY_TO_EOF);
    }
}


class FileWatcher extends events.EventEmitter{
    constructor(reader){
        super();
        this.reader = reader
        this.filename = reader.filename;
        this.separator = lineMode ? /[\r]{0,1}\n/ : null;
        this.flushAtEOF = false;
        this.encoding = 'utf-8';
        this.fromBeginning = false;
        this.fsWatchOptions = {};

        this.internalDispatcher = new events.EventEmitter();
        this.queue = [];
        this.isWatching = false;
        this.pos = reader.initFileSize;

        this.internalDispatcher.on('next', ()=>{
            this.readBlock();
        })
    };

    watch(){
        if(this.isWatching)return;
        this.isWatching = true;
        this.watcher = fs.watch(this.filename, this.fsWatchOptions,
                                (e, f)=>{this.watchEvent(e, f);})
        
    }

    watchEvent(e, evtFilename){
        if(e === 'change'){
            this.change();
        }else if (e === 'rename'){
            let data = {'newName':evtFilename};
            this.internalDispatcher.emit('rename', data)
            this.emit('rename', data);
        }
    }

    change(){
        let stats;
        try{
            stats = fs.statSync(this.filename);
        }catch(e){
            throw Error(`Can't stat ${this.filename}`);
        }
        this.pos = stats.size <= this.pos ? stats.size : this.pos;
        if(stats.size > this.pos){
            this.queue.push({'start': this.pos, 'end':stats.size});
            this.pos = stats.size;
            if(this.queue.length === 1){
                this.internalDispatcher.emit('next');
            }
        }
    }

    rename(){}

    readBlock(){
        if(this.queue.length >= 1){
            let block = this.queue[0];
            if(block.end > block.start){
                var stream = fs.createReadStream(
                                this.filename, 
                                {'start': block.start, 'end':block.end - 1}
                            )
        
                stream.on('error', (error)=>{this.emit('error', error)});
                stream.on('end', ()=>{
                    let x = this.queue.shift();
                    if(this.queue.length > 0){
                        this.internalDispatcher.emit('next');
                    }
                    if(this.flushAtEOF && this.buffer.length > 0){
                        this.emit('data', this.buffer);
                        this.buffer = '';
                    };
                });
                stream.on('data', (data)=>{
                    if(this.separator === null){
                        this.emit('data', data);
                    }else{
                        this.buffer += data;
                        let parts = this.buffer.split(this.separator);
                        this.buffer = parts.pop()
                        for(let part of parts){
                            this.emit('data', part);
                        } 
                    }
                })
            }
        }
    }
}


class Utils{

    static max(a, b, ...c){
        // Quick sort;
    }

    static match(str, key){
        // KMP
    }
}

// export Tail as a lib?
tail = new Tail(options, args);
tail.run();