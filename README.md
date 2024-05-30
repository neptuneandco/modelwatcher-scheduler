# ModelWatcher Scheduler
ModelWatcher-Scheduler is designed to watch output from long-running models and automatically trigger postprocessing/rendering scripts every time the output file is updated.

![model watching robot](./ModelWatcherScheduler.png)

## Installation
TODO

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