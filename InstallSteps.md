 ##Install Steps
 1. Start with a folder ```<nodeLSL>``` as the root folder.
 2. Download jna-4.2.2.jar to ```<nodeLSL>``` from http://central.maven.org/maven2/net/java/dev/jna/jna/4.2.2/jna-4.2.2.jar
 3. Extract contents of jna-4.2.2.jar to ```<nodeLSL>``` (it behaves like a normal zip file with most zip utilities) 
  - After extraction, you should see a ```<nodeLSL>/com``` folder.
 4. Dowload the LSL implementation from https://github.com/sccn/labstreaminglayer
 5. Extract and copy the contents of liblsl-Java/src to ```<nodeLSL>``` 
  - After extraction, new folders ```<nodeLSL>/edu``` and ```<nodeLSL>/examples``` should appear.
 6. Download and extract the contents of this repository 
  - New folders ```<nodeLSL>/src```, ```<nodeLSL>/vis``` should appear.
 7. Compile ```<nodeLSL>/src/LSLWrapper.java``` from ```<nodeLSL>``` using the command : 
```
>javac -cp jna-4.2.2.jar edu/ucsd/sccn/LSL.java src/LSLWrapper.java src/ReceiveExample.java src/SenderExample.java src/SenderTestExample.java -d . 
```
 - Successful compilation will result in a new ```<nodeLSL>/uk/ac/lancs/scc/nodeLSL``` folder with LSLWrapper.class, ReceiveExample.class, SenderTestExample.class and SenderExample.class inside it.
8. From ftp://sccn.ucsd.edu/pub/software/LSL/SDK/ download the lastest java version file (e.g. liblsl-Java-1.11.zip).
9. Extract the .dll/.so files from it and place them in ```<nodeLSL>``` [this is for Windows 7 or higher, not tested otherwise]
10. If you wish to compile these yourself, use the instructions from https://github.com/sccn/labstreaminglayer 
11. Test if the dlls and LSLWrapper work together properly. To do so, launch two separate consoles from ```<nodeLSL>``` and run these commands (one in each console):
```
>java uk/ac/lancs/scc/nodeLSL/SenderTestExample
```
and
```
>java uk/ac/lancs/scc/nodeLSL/ReceiveExample
```
 - If successful, the receiveExample should receive the data the SendTestExample is sending [Tweak firewall settings if required].

12. Install node.js from https://nodejs.org/en/download/
13. Install dependencies. To do so, from ```nodeLSL>``` use command (it will pick up package.json in ```<nodeLSL>``` and install everything required): 
```
>npm install
```
 - Since we use node-java, which in turn relies on node-gyp and Python 2.x, if these are pre-installed, above step is a blur.
 - However, for fresh installs, node-gyp installation is a bit fiddly on Windows. If there were errors in installation, try the install instructions for node-gyp [https://github.com/nodejs/node-gyp] first.
14. Load the nodeLSLServer using command: 
```
>node nodelslserver.js
```
15. In browser, go to http://localhost:3000 to load the visualizer page
16. For test purposes, run this command in ```<nodeLSL>```: 
```
>java uk/ac/lancs/scc/nodeLSL/SendTestExample 
```
- if everything is working fine, the visualizer page will receive some data from nodelslserver and display it
17. Update ```<nodeLSL>/vis/access.js array->electrodeMap``` to display the EEG nodes used in your protocol 
