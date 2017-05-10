##**nodeLSL - Node Bridge for LabStreamingLayer**

###Is this implementation for you? 
It is, if you:

- Have built node.js apps before
- Want to use a LSL-compatible device with node.js
- Want the implementation which is Java-lite and node-heavy (yet, async and non-blocking)
- Are a Java beginner/non-expert (some instructions below are written with non-experts in mind)
- At its core, nodelslserver uses node-java and a custom LSLWrapper class to port the functionality provided by LSL (the important bits?) and forwards the LSL Stream as json packets over websockets using promises to allow non-blocking async operation.

###Install instructions: 
See IntallStep.txt

###Usage
1.  ```nodelslserver.js``` : Accepts command line arguments, run with ```-help``` flag for more details. It can record an incoming stream for later reuse by ```nodelslplayer.js``` 
2. A basic bridge configuration consists of:
> - ```<Your LSL EEG Device>``` streaming ***EEG*** or ***Quality*** or ***Markers*** streams 
> - ```nodelslserver.js``` recording and transmitting these streams over Websockets on ***Port 1337*** 
> - ```Visualizer.html```  available on ***Port 3000*** or directly loaded from folder connected to ***ws:1337***

3. ```nodelslserver.js``` can also record streams to plain text files. ```nodelslplayer.js``` can replay one stream per instance and replace the LSL EEG Device in the basic configuration above. It also accepts command line arguments e.g. ```node nodelslplayer -re -n 8 -t 250 -file Sample.txt``` sends the contents of Sample.txt at 250Hz, 8 channels as EEG data. (Sample.txt should contain tab-separated or comma-separated float values, 8 per line)
