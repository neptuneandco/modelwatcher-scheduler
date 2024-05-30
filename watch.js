#! /usr/bin/env node
//    _____             .___     .__                  __         .__                  
//   /     \   ____   __| _/____ |  |__  _  _______ _/  |_  ____ |  |__   ___________ 
//  /  \ /  \ /  _ \ / __ |/ __ \|  |\ \/ \/ /\__  \\   __\/ ___\|  |  \_/ __ \_  __ \
// /    Y    (  <_> ) /_/ \  ___/|  |_\     /  / __ \|  | \  \___|   Y  \  ___/|  | \/
// \____|__  /\____/\____ |\___  >____/\/\_/  (____  /__|  \___  >___|  /\___  >__|   
//         \/            \/    \/                  \/          \/     \/     \/       
//
// Script for watching models and launching render scripts when the model is updated.
//
'use strict'
process.chdir(__dirname);

// Libraries
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const {flock} = require('fs-ext');

const watchfile = 'watchlist.json';

// File shows which render scripts we can execute.
var renderers = JSON.parse( fs.readFileSync('renderers.json', 'utf8') );

// Render status.
var renderQ = [];
var renderTimer = null;
var renderLock = false;
var renderDelay = 10000;   // Delay to start rendering in milliseconds (10 seconds). TODO - move to renderers.json.
//var renderDelay = 1000;   // 1 seconds for testing.

var theWatched = {};     // The models we are watching.



// File IO ---------------------------------------------------------------------

/**
 * Call to read the current watchlist. We make sure it always exists.
 */
function readWatchlist() {
    var watchlist;
    const watchfileFD = fs.openSync(watchfile, 'r');
    const file = fs.readFileSync(watchfileFD, 'utf8');

    try {
        watchlist = JSON.parse(file);
    } catch (err) {
        watchlist = { "count": 0, "watch": {} };
    }

    fs.closeSync(watchfileFD);

    return watchlist;
}

/**
 * Call to read the current watchlist. We make sure it always exists.
 */
function writeWatchlist(watchlist) {
    const watchfileFD = fs.openSync(watchfile, 'w');
    fs.writeFileSync(watchfileFD, JSON.stringify(watchlist, null, 4));
    fs.closeSync(watchfileFD);
}

/**
 * Lock the watchlist file.
 */
function lockFile(watchfileFD) {
    return new Promise((resolve, reject) => {
        flock(watchfileFD, 'ex', (err) => {
            if (err) {
                reject(`Failed to lock watchlist:' ${err}`);
            }

            resolve();
        });
    });
}

/**
 * Unlock the watchlist file.
 * @returns {Promise}
 */
function releaseFile(watchfileFD) {
    return new Promise((resolve, reject) => {
        flock(watchfileFD, 'un', (err) => {
            if (err) {
                reject(`Failed to unlock watchlist:' ${err}`);
            }
            resolve();
        });
    });
}

/**
 * Save a status update to the watchlist.
 */
async function saveState(wid, state, remove=false) {
    console.log(`state wid:${wid} ${state}`);
    if (watchlist.watch[wid] !== undefined) {
        watchlist = readWatchlist();
        if (remove) {
            watchlist.watch[wid] = undefined;
        } else {
            watchlist.watch[wid].state = state;
        }
        writeWatchlist(watchlist);
    }
    return;
}

// Watch Functions -------------------------------------------------------------

/**
 * Watch a specific model.
 * @param {Object} model 
 */
function watchModel(model, id) {
    let renderer = renderers[model.renderer];
    
    if (theWatched[id] !== undefined) {
        return;
    }

    console.log(id.padStart(6,' ') + ` - renderer:${model.renderer} for:${model.who} at:${model.basedir}`);
        
    if (model.repeat === false) {

        // Any model that doesn't have repeat should be rendered right away and then removed from the watchlist.
        queueModel(model, id);
        console.log(`QUEUE: ${id} ${model.basedir} ${renderer.script}`);

    } else {

        // Watch the model and queue a render when it changes.
        const file = path.join(model.basedir, renderer.watchfile);
        let watch = null;
        try {
            watch = fs.watch(file, (event, filename) => {
                queueModel(model, id);
            });
        } catch (err) {

            console.log('fs.watch error on', model.basedir);
            setTimeout(() => {
                saveState(id, 'not-found');
            });
        }
    
        // Keep track.
        theWatched[id] = {
            file: file,
            script: renderer.script,
            basedir: model.basedir,
            who: model.who,
            watchFn: watch
        }
    }
}

/**
 * Queue a model for rendering.
 * @param {Object} model 
 */
function queueModel(model, id) {
    const renderer = renderers[model.renderer];

    let inQ = false;
    for (let i = 0; i < renderQ.length; i++) {
        if (renderQ[i].path === model.basedir) {
            inQ = true;
            break;
        }
    }

    // Queue a render if not already in queue.
    if (!inQ) {
        console.log(`QUEUED: ${id} ${model.basedir} ${renderer.script}`);

        saveState(id, 'queued');
        renderQ.push({ path: model.basedir, script: renderer.script, wid: id, env: renderer.env });
        if (renderTimer === null) {
            renderTimer = setTimeout(renderNextInQ, renderDelay);
        }
    }
}

/**
 * Check failed watches to see if they are now available.
 */
function checkFailedWatches() {
    for (const id in theWatched){
        if (theWatched[id] && theWatched[id].watchFn === null) {
            let watchFn = null;
            try {
                watchFn = fs.watch(theWatched[id].file, (event, filename) => {
                    queueModel(watchlist.watch[id], id);
                });
                setTimeout(() => {
                    saveState(id, 'watching');
                });
            } catch (err) {
            }

            // Keep track.
            theWatched[id].watchFn = watchFn;
        }
    }
}

/**
 * Iterate through clusters to set up watch.
 */
function watchModels() {
    console.log('* Now Watching');
    cleanModels();
    for (const model in watchlist.watch){
        watchModel(watchlist.watch[model], model);
    }
}

/**
 * Stop watching anything that isn't in the watchlist.
 */
function cleanModels(){
    for (const model in theWatched){
        if (watchlist.watch[model] === undefined) {
            if (theWatched[model] && theWatched[model].watchFn)
                theWatched[model].watchFn.close();
            theWatched[model] = undefined;
        }
    }
}

/**
 * Watch the configuration files so we can automatically
 * maintain configuration.
 */
function watchConfiguration(){

    fs.watchFile('watchlist.json', (curr, prev) => {
        watchlist = readWatchlist();
        watchModels();
    });

    fs.watchFile('renderers.json', (curr, prev) => {
        resultsFiles = JSON.parse( fs.readFileSync('renderers.json', 'utf8') );
    });
}

/**
 * This function renders the next model renderer in renderQ.
 */
function renderNextInQ(){
    var task;
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Wait for any current rendering to finish.
    if (renderLock)
        return;
    renderTimer = null;

    // Launch render.
    task = renderQ[0]
    if (task){
        console.log(`RENDER: ${task.script} ${task.path}`);
        saveState(task.wid, 'rendering');

        // Ensure one render at a time.
        renderLock = true;

        // Spawn the render script and save the output to a log file.
        const log = `./log/watch${task.wid}.txt`;
        const env = task.env || {};
        const childProcess = cp.spawn('bash', [task.script, task.path], { env:env, windowsHide: true, shell: true, cwd: path.join(__dirname, 'renderscripts') });

        childProcess.stdout.on('data', (data) => {
            fs.appendFile(log, data, (err) => {
                if (err) { console.error(`Error appending to ${log} :`, err); }
            });
        });
        childProcess.stderr.on('data', (data) => {
            fs.appendFile(log, data, (err) => {
                if (err) { console.error(`Error appending to ${log} :`, err); }
            });
        });
        childProcess.on('close', (code) => {
            console.log(`RENDERED(${code}):`, task.path);
            fs.appendFile(log, `Finished with code: ${code}\n---------\n`, (err) => {
                if (err) { console.error(`Error appending to ${log} :`, err); }
            });
            saveState(task.wid, formattedDate, !watchlist.watch[task.wid].repeat);

            // Render next in Q.
            renderLock = false;
            renderTimer = setTimeout(()=>{ renderQ.shift(); renderNextInQ(); }, renderDelay);
        });
        childProcess.on('error', (error) => {
            console.error(`Error spawning child process: ${error.message}`);
            saveState(task.wid, 'render error');

            // Render next in Q.
            renderLock = false;
            renderTimer = setTimeout(()=>{ renderQ.shift(); renderNextInQ(); }, renderDelay);
        });
    }
}


//------------------------------------------------------------------------------
// Startup ---------------------------------------------------------------------
//------------------------------------------------------------------------------

// Load our watchlist which contains what models are being watched by modelwatcher.
let watchlist = { "count": 0, "watch": {} };
if (!fs.existsSync(watchfile)) {
    fs.writeFileSync(watchfile, JSON.stringify(watchlist, null, 4));
}
watchlist = readWatchlist();

watchModels();
watchConfiguration();
setInterval(checkFailedWatches, 60000);  // Check for failed watches every minute.
