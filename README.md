# nodeLSL
Node Bridge for LabStreamingLayer
Is this implementation for you? It is, if you:
> Have built node.js apps before
> Want to use a LSL-compatible device with node.js
> Want the implementation which is Java-lite and node-heavy (yet, async and non-blocking)
> Are a Java beginner/non-expert (some instructions below are written with non-experts in mind)

Install instructions: 
1. Start with a folder <nodeLSL> as the root folder.
2. Download jna-4.2.2.jar to <nodeLSL> from http://central.maven.org/maven2/net/java/dev/jna/jna/4.2.2/jna-4.2.2.jar
3. Extract contents of jna-4.2.2.jar to <nodeLSL> (it behaves like a normal zip file with most zip utilities) ...after extraction, you should see a <nodeLSL>/com folder.
4. Dowload the LSL implementation from https://github.com/sccn/labstreaminglayer
5. Extract and copy the contents of liblsl-Java/src to <nodeLSL> ...after extraction, new folders <nodeLSL>/edu and <nodeLSL>/examples should exist.
6. Download and extract this repository ...New folders <nodeLSL>/src, <nodeLSL>/vis should appear.
7. Compile <nodeLSL>/src/LSLWrapper.java from <nodeLSL> using the command : 
>javac -cp jna-4.2.2.jar edu/ucsd/sccn/LSL.java src/LSLWrapper.java src/ReceiveExample.java src/SenderExample.java src/SenderTestExample.java -d . 
	...Successful compilation will result in a new <nodeLSL>/uk/ac/lancs/scc/nodeLSL folder with LSLWrapper.class, ReceiveExample.class, SenderTestExample.class and SenderExample.class inside it
8. From ftp://sccn.ucsd.edu/pub/software/LSL/SDK/ download the lastest java version file (e.g. liblsl-Java-1.11.zip).
9. Extract the .dll/.so files from it and place them in <nodeLSL> [this is for Windows 7 or higher, not tested otherwise]
	...If you wish to compile these yourself, use the instructions from https://github.com/sccn/labstreaminglayer
10. Test if the dlls and LSLWrapper work together properly. To do so, launch two separate consoles from <nodeLSL> and run these commands (one in each console):

	...java uk/ac/lancs/scc/nodeLSL/SenderTestExample

	...java uk/ac/lancs/scc/nodeLSL/ReceiveExample

>if successful, the receiveExample should receive the data the SendTestExample is sending [Tweak firewall settings if required].	 
11. Install node.js from https://nodejs.org/en/download/
12. Install dependencies. From <nodeLSL> use command (it will pick up package.json in <nodeLSL> and install everything required): npm install
13. Load the nodeLSLServer using command: 
>node nodelslserver.js
14. In browser, go to http://localhost:3000 to load the visualizer page
15. For test purposes, run this command in <nodeLSL>: java uk/ac/lancs/scc/nodeLSL/SendTestExample 
	...if everything is working fine, the visualizer page will receive some data from nodelslserver and display it
16. Update <nodeLSL>/vis/access.js > electrodeMap to display the EEG nodes used in your protocol 
