# ModelWatcher Scheduler
ModelWatcher-Scheduler is designed to watch output from long-running models and automatically trigger postprocessing/rendering scripts every time the output file is updated.

![model watching robot](./ModelWatcherScheduler.png)

## Installation
ModelWatcher-Scheduler (MWS) runs on Linux based systems and has been tested on MacOS and Ubuntu 22. This early version of MWS does not have an installer so will need to be downloaded and configured by hand. The instructions assume you are working in a linux shell (bash or zsh). Follow these installation steps:

1) You will need to have Node.js installed on your system to run MWS. Check to see if node is already installed by checking its version:
```bash
node -v
```
If node is not found, you can find node installation instructions at: [NodeJS](https://nodejs.org/en)

2) Clone MWS into your linux account.
```bash
https://github.com/neptuneandco/modelwatcher-scheduler.git
```

3) Set up a path to MWS's bin directory. You can do this by adding modelwatcher-scheduler/bin to your .bashrc or .zshrc environment path. Remember to run source on your .bashrc for the change to take effect.
```bash
export PATH=~/source/modelwatcher-scheduler/bin:$PATH
```

4) Install MWS node dependencies.
```bash
cd modelwatcher-scheduler
npm install
```

5) Run the MWS watcher script. You will want modelwatcher-scheduler/watch.js to run in the background so that it can receive requests and watch model output. A convenient way to do this is using [PM2](https://pm2.keymetrics.io/). Alternatively you can keep it running in tmux or use nohup or even make it a systemD process if you are more experienced with Linux systems.

```bash
npm install pm2 -g
cd modelwatcher-scheduler
pm2 start watch.js
```
See PM2 for documentation on how to start and stop processes it manages.

### Adding Scripts
Rendering scripts are defined in:
- modelwatcher-scheduler/renderers.json

Each script should have a json entry in the following form. Watchfile tells ModelWatcher what file to look observe for changes triggering a postprocess event.
```json
{
    "no-op": {
        "script": "script.sh",
        "watchfile": "./subdir/modeloutput.txt",
        "env": {
            "ENV_VAR":"/home/somewhere/"
        }
    }
}
```
Postprocessing and rendering scripts need to be kept in the renderscripts directory. You 

### Multi-User 
ModelWatcher-Scheduler is designed to work as a multi-user system similar to Slurm. To use it this way, you need to make the modelwatcher/bin directory visible to your modelers and others that want to use it. You will also need correct permissions for model output, scripts, and result direcories and files.

## Usage
Users access Modelwatcher-Scheduler through the following commands.

### mls
List models being watched. This will list all models being watched along with a status.
```bash
> mls
Now Watching
id        renderer       status              user                directory
4         no-op          11/14/2023, 11:07   modelwatcher        /home/modelwatcher/testproject
9         scriptname     watching            sswanson            /home/sswanson/models/grid100
```
- Queued - scheduled to be rendered.
- Watching - model being watched but hasn't been rendered yet.
- Date - last time the model was rendered.
- Error - something went wrong.

### mwatch <renderer> <model directory>
Watch a model for automatic postprocessing/rendering. In this case we are going to watch the model in the current directory and apply the "scriptname" rendering script when the model output is updated. The file being watched in your model directory is defined in renderers.json. You can put a path in place of "." just like you can with other linux commands. You can manually trigger a rendering my running on whe watched file.
```bash
> mwatch scriptname /home/sswanson/modelrun/grid100
Now Watching
id:10 renderer:srr for:sswanson at:/home/sswanson/modelrun/grid100
```

### mrender <renderer> <model directory>
Mrender is the same as mwatch but is applied immediately and does not continue watching the model.

### mrm <watchid>
Remove a model from being watched. "watchid" is a number assigned to the model being watched. You can get the watch id by running mls.
```bash
> mrm 10
Removed model watcher entry: 10 /home/sswanson/modelrun/grid100
```

### mstatus <watchid>
You can view the output of the rendering script for any model that has been rendered using mstatus. "watchid" is a number assigned to the model being watched. You can get the watch id by running mls.
```bash
> mstatus watchid
```

## Scripting and Slurm

If your model is being run with a script such as an sbatch script for Slurm, the following will help you automate starting and stopping ModelWatcher-Scheduler.

1. Start modelwatcher
Run mwatch on the current directory retreive the id of the watch.
```bash
result=$(ssh petras "mwatch scriptname .")
idgroup=$(echo "$result" | grep 'id:' | awk '{print $1}')
watchid=$(echo "$idgroup" | sed 's/id://')
```

2. Run your model.

3. Stop modelwatcher when the model is finished.
Run this to make modelwatcher stop watching the project.
```bash
ssh petras "mrm $watchid"
```

## Contact
Skyler Swanson - [sswanson@neptuneinc.org](mailto:sswanson@neptuneinc.org)
