const fs = require("fs");
const net = require('net');
const WebSocketServer = require('websocket').server;
const http = require('http');
const express = require('express');
const util= require('util');

var java = require('java');
java.asyncOptions = {
  asyncSuffix: "Async",     // Don't generate node-style methods taking callbacks
  syncSuffix: "Sync"              // Sync methods use the base name(!!) 
}

const path = require('path');
java.classpath.push(path.resolve(__dirname),"examples");
var lslWrapper = java.import('uk.ac.lancs.scc.nodeLSL.LSLWrapper');
var except = java.import('java.io.IOException');

var HTTPPORT = 3000;
var WSPORT = 1337;
var BLIPINTERVAL = 5000;
var wsStatus = {externalIP:false, browserClients:[], noHTTP:false};
var recorderObj = {fileOpen:[], writeable:[], dataBuffer:[], wstream:[], waitAsync:[], record:[], written:0, lastWriteCnt:0};

var itrCntr = 0; 
var abortN = false;	//if true, the inlet stream is turned off after reading a few samples, should be false for actual usage
var streamStatus = []; //maintains a list of objects that hold the references to the inlet streams and other details of the streams
var tcpStatus = {source:"None",lastMsgTimestamp:Date.now(),status:"undefined",handshakePingAt:0, ticker:false, timerHnd:null, clientHnd:null, wait:Date.now(), connError:false};

init();

function init(){//start both  ends of the bridge
	//process the command line arguments first
	var invalidFlag=false;
	initRecorderState();
	
	process.argv.forEach(function(val, index){ 
		switch(index){
			case 1:
			case 0:
				//do nothing
				break;
			default: //for all other indices process
				invalidFlag |= processArgs(val.toUpperCase());// once true, always true				
		}				   
	});
	
	if(invalidFlag){
		showValidOptions();
		process.exit(); //abort current run
	}
	
	console.log("INFO: Starting Node LSL Bridge");
	var recordStr = recorderObj.record[lslWrapper.LSL_EEG]?"EEG ":"" +recorderObj.record[lslWrapper.LSL_QUALITY]?"Quality ":"" + recorderObj.record[lslWrapper.LSL_MARKERS]?"Markers":""; 
	console.log("INFO: Recording: ", recordStr.length>0?recordStr:"None");
	console.log("INFO: RemoteRequests:" + (wsStatus.externalIP?"A":"Disa")+"llow");
	  
	wsInit();
	//TCPHandshakeInit(); 
	if(!wsStatus.noHTTP){
		initHTTPServer();
	}
	else{
		console.log("INFO: HTTP Server disabled. Restart without -NOHTTP flag to enable it.");
	}
	openInletStreams();
}

function openInletStreams(){
	console.log("INFO: Opening", lslWrapper.LSL_EEG, lslWrapper.getStreamNameSync(lslWrapper.LSL_EEG));
	openStream(lslWrapper.LSL_EEG);
	console.log("INFO: Opening", lslWrapper.LSL_QUALITY, lslWrapper.getStreamNameSync(lslWrapper.LSL_QUALITY));
	openStream(lslWrapper.LSL_QUALITY);
	console.log("INFO: Opening", lslWrapper.LSL_MARKERS, lslWrapper.getStreamNameSync(lslWrapper.LSL_MARKERS));
	openStream(lslWrapper.LSL_MARKERS);
}

function initRecorderState(){
	recorderObj.record[lslWrapper.LSL_EEG] =false; //basic init
	recorderObj.record[lslWrapper.LSL_QUALITY] =false; 
	recorderObj.record[lslWrapper.LSL_MARKERS] =false;
	
	recorderObj.fileOpen[lslWrapper.LSL_EEG] =false; //basic init
	recorderObj.fileOpen[lslWrapper.LSL_QUALITY] =false; 
	recorderObj.fileOpen[lslWrapper.LSL_MARKERS] =false;
	
	//basic init, wait for file to be created before we can write to it. Buffer for now
	recorderObj.waitAsync[lslWrapper.LSL_EEG] =true; 
	recorderObj.waitAsync[lslWrapper.LSL_QUALITY] =true; 
	recorderObj.waitAsync[lslWrapper.LSL_MARKERS] =true;
}

function processArgs(val){
	var val2 = val.toUpperCase();
	//strip modifier prefixes
	while(val2.indexOf("-")==0){
		val2 = val2.substr(1,val2.length);
	}
	while(val2.indexOf("/")==0){
		val2 = val2.substr(1,val2.length);
	}
	while(val2.indexOf("\\")==0){
		val2 = val2.substr(1,val2.length);
	}
	
	switch(val2){
		case "REEG"://record incoming streams to separate files
			recorderObj.record[lslWrapper.LSL_EEG] =true; 
			openRecorder(lslWrapper.LSL_EEG);
			return false; break;
		case "RQ"://record incoming streams to separate files
			recorderObj.record[lslWrapper.LSL_QUALITY] =true; 
			openRecorder(lslWrapper.LSL_QUALITY);		
			return false; break;
		case "RMARK"://record incoming streams to separate files
			recorderObj.record[lslWrapper.LSL_MARKERS] =true;		 
			openRecorder(lslWrapper.LSL_MARKERS);
			return false; break;
		case "X"://allow remote connections to server 
			wsStatus.externalIP=true; 
			console.log("\nWARN: Allow remote connection requests. [Not advised].\n");
			return false; break;
		case "H": //show help options and then exit
		case "HELP":
			showValidOptions();
			process.exit();
			break;
		case "NOHTTP"://no visualizer page being served on localhost:PORT
			wsStatus.noHTTP=true; 
			return false; break;
		default:
			console.log("ERR: Unknown flag: ", val);
			return true;
	}
	
	return true; //if here, no valid flag found
}

function showValidOptions(){
	console.log("INFO: Valid command options are:");
	console.log("\t-REEG : Record incoming EEG stream to new file.");		
	console.log("\t-RQ : Record incoming Quality stream to new file.");		
	console.log("\t-RMARK : Record incoming Marker stream to new file.");
	console.log("\t-X : Allow remote connection requests. [Not advised]");      
	console.log("\t-NOHTTP: Disable HTTP server serving the visualiser page on port "+ HTTPPORT);
	console.log("\t-HELP: Show this message");
}

function wsInit(){//this is the websocket part which allows data from the LSL Inlet Stream to be pumped to a browser page
	var server = http.createServer(function(request, response) {
		// process HTTP request. Since we're writing just WebSockets server
		// we don't have to implement anything.
		enumObject(request);
	});
	server.listen(WSPORT, function() {//this is the port which serves the data 
		console.log("INFO: WebSocket Server Port: "+WSPORT);
	});

	// create the server
	wsServer = new WebSocketServer({
		httpServer: server,
		autoAcceptConnections: false
	});

	wsServer.on('request', function(request) {
	   //we only allow local connections, default choice
		if(isAllowedIP(request.remoteAddress)){//by default only local connections are allowed, if app is started with -X flag, then remote address are also allowed
			console.log("INFO: Incoming WS connection from: " +request.remoteAddress);
		}        
		else{
			console.log("ERR: Rejecting WS connection request from remote client:"+request.remoteAddress);
			var connection = request.reject(102, 'Remote Connection Request Denied. Re-run nodeLSLServer with -X flag');
			return;
		}
	   
		var connection = request.accept(null, request.origin);// create the connection
		
		var index =wsStatus.browserClients.push(connection)-1; //save it for later use
		
		// all messages from users are handled here
		connection.on('message', function(message) {
			if (message.type === 'utf8') {
				// process WebSocket message
				console.log("INFO: WS Client Message>", message.utf8Data);
			}
			if(!tcpStatus.ticker){//if a timer has not been created yet, create one now. this ensures a keepAlive blip is sent to clients in the absence of a live LSL Stream
				tcpStatus.ticker = true; //start a timer
				tcpStatus.timerHnd = setInterval(keepAlive, BLIPINTERVAL, 'keepAliveWhenLSLNotPresent');
			}	
		});

		connection.on('close', function(connection) {
			// close user connection
			var client = (typeof(wsStatus.browserClients[index])!=="undefined")? wsStatus.browserClients[index].remoteAddress:"";
			console.log("WARN: Client: "+ client + " on WS "+connection.toString() + " disconnected");
			wsStatus.browserClients.splice(index, 1);
		});
	});
}

function initHTTPServer(){//this is needed to let browsers request the visualizer page
	//setup the server using express
	var httpServer = express();
	httpServer.use(function(req, res, next){//basic debug function
		//console.log('INFO: %s %s from %s , proxy: %s', req.method, req.url, req.ip, util.inspect(req.ips));
		next();
	});
	//order is important...
	httpServer.use(allowExternalIP); //middleware function to check if we want to block external IPs (abuse risk)
	
	httpServer.get('/', function(req, res) {//serve for the default http://localhost/ call
		res.sendFile(path.join(__dirname + '/vis/Visualizer.html'));
	});

	httpServer.use(express.static('vis')); //serve static files from the html directory on subsequent named gets	
	
	httpServer.listen(HTTPPORT); //true http server, get it rolling.
	console.log("INFO: HTTP Server Port: "+HTTPPORT);
}

// here the middleware function, it filters by ip, if ip is clean, call next callback.
function allowExternalIP (req, res, next) {
	if(isAllowedIP(req.ip)){
		next();
	}        
	else{
		console.log("WARN: Rejected",req.ip, " To allow access restart with -X flag.");
		res.status(403).end('');
	}
}

function isAllowedIP(ip){
	//console.log("INFO: Allowed IP check:",wsStatus.externalIP, ip);
	return wsStatus.externalIP||(ip=="::1")||(ip=="::ffff:127.0.0.1");
}

function openRecorder(streamType){//this function creates and opens a file and a stream to write into it through an async promise-based non-blocking approach
	console.log("INFO: Starting recorder for ",lslWrapper.getStreamNameSync(streamType));
	var fsWriterPromise = new Promise(function(resolve, reject) {
		//this is an asynchronous attempt to open an output file stream using promises
		//this opens the file and then checks if buffered data exists. if it does, it is written to file before proceeding
		recorderObj.waitAsync[streamType] = true; //tell any data being generated to buffer till we are ready to write to file
		console.log("INFO: Opening file to record", getFileName(lslWrapper.getStreamNameSync(streamType)), "data");
		var fsWS = fs.createWriteStream(getFileName(lslWrapper.getStreamNameSync(streamType)));
		//console.log("DEBUG: Opening Recorder inside promise.2");
		fsWS.on('error',function(err){
			console.log("ERR: Recorder write failed with error:\n"+err);
			reject(err);
		});
		fsWS.on('open', function(){
			console.log("INFO:",lslWrapper.getStreamNameSync(streamType),"Recorder file open");
			recorderObj.fileOpen[streamType] = true;
			resolve("success");
		});
		recorderObj.wstream[streamType] = fsWS;
	});
	
	fsWriterPromise.then(
		function(data){//we were able to file a file to write to, now process pending data
			//write all the data buffered so far
			if(recorderObj.dataBuffer.length>0) 
				console.log("INFO: Processing pending write buffer for",lslWrapper.getStreamNameSync(streamType), recorderObj.dataBuffer.length, "entries pending...");
			for(var i=0;i<recorderObj.dataBuffer.length; i++){
				if(recorderObj.dataBuffer[i].streamType==streamType){
					data = recorderObj.dataBuffer.splice(i,1)[0]; //we eliminate each record we have just picked up to write
					console.log("INFO: Buf obj", data);
					var bln = recorderObj.wstream[data.streamType].write(data.sample.join("\t")+"\n",'utf8');
					i--; //for ensuring that we don't skip records
				}
			}
			//then set to sync write for all future entries	
			recorderObj.waitAsync[streamType] = false;
		},
		function(error){
			//process error.
			console.log("ERR: Could not open file to record LSL Inlet Stream", error);
			console.log("ERR: Aborting...");
			process.exit();
		}
	
	);
}

function recordData(data){//this function writes the LSL Stream input to a file so that it can be broadcast later
	//console.log("DEBUG:------>Logging",data);	
	//extra layer of checks
	if(!recorderObj.record[data.streamType]){
		console.log("ERR: No recording planned for "+lslWrapper.getStreamNameSync(data.streamType));
		console.log("\tRestart with the correct -R<Stream> flag");
		return;
	}
	//console.log("DEBUG: Recording data as planned");
	if(recorderObj.waitAsync[data.streamType]){//waiting for the file to be opened, etc...
		console.log("WARN: Write deferred, buffering...")
		recorderObj.dataBuffer.push(data);		
	}
	else{//now ready to write
		//console.log("DEBUG: Writing",data.sample.join("\t"));
		recorderObj.wstream[data.streamType].write(data.sample.join("\t")+"\n",'utf8');		
	}
}

function getFileName(streamName){//used during recording, provides a filename 
	return streamName+"-"+(new Date()).toJSON().split(".")[0].replace("T","-").replace(":","-").replace(":","-") +".log";	
}

function keepAlive(){//keep alive message for the WebSocket clients
	//console.log("DEBUG: Keep alive", (tcpStatus.lastMsgTimestamp-Date.now()), tcpStatus.status);
	var keepAliveObj = {"streamType":-1, "dataType":"String", "sample":["Keep Alive"],"source":"LSLNodeServer",	"name":"Keep Alive"};
	if((Date.now()-tcpStatus.lastMsgTimestamp)>BLIPINTERVAL){//if there has been a delay of more than 1 second since last message
		//we send a 'keep Alive' message
		var json = JSON.stringify(keepAliveObj);
		for (var i=0; i < wsStatus.browserClients.length; i++) {//sent to every single connected client
			wsStatus.browserClients[i].sendUTF(json);
		}
	}	
}

function openStream(streamType){//call this function to open a new stream and setup a read process for it. this is async through promises and java instances.
	var lslStreamPromise = new Promise(function(resolve,reject){
		var strName = lslWrapper.getStreamNameSync(streamType);
		console.log("INFO: Opening LSL Inlet Stream for type ("+ streamType+")",strName);
		try{
			//create a new object of type LSLWrapper, this is required for non-blocking behaviour which is achieved with object methods but not static class methods
			var obj = java.newInstanceSync("uk.ac.lancs.scc.nodeLSL.LSLWrapper"); 
			var res = obj.openInletStreamAsync(streamType,function(err,res){//open an inlet stream using the streamType provided
				if(res.substr(0,4)!="INFO"){//successful creation will return a message starting with INFO, else ERR is returned
					reject(res);
				}
				else{
					console.log("DEBUGNode: LS Stream open");
					resolve({"obj":obj,"type":streamType,"response":res,"strName":strName});					
				}
			});
		}
		catch(e){
			console.log("ERR: Stream open failed with error",e);
			reject("ERR: "+e); // status is not 200 OK, so reject
		}
	});

	lslStreamPromise.then(//we now have a stream object, save it 
	function(data) {
		console.log("INFO: LSL Inlet stream found and connected to: ", data.strName);		
		streamStatus[data.type] = {"obj":data.obj,"started":true,"continueStream":true, "sourceId":data.obj.getInletSourceIdSync(), "sourceName":data.obj.getInletSourceIdSync(),"sourceName":data.strName};//save status
		readSamples(streamType,"");//start reading samples off it
	}, 
	function(error) {
		console.log('ERR: Failed to initialize stream');
		console.log("ERR:", error);
	}).catch(
		function(error){
			console.log("ERR:", error);
			console.log("ERR: Aborting...");
			process.exit();
		}
	);; 
}

//chained promises for a similar repeated activity
//this function is recursively called by each openStream result through a promise chaining approach
//the breakout code is in processSample and exit is disabled while abortN = false.
function readSamples(streamType, dataType){
	//console.log("DEBUG: ",streamType, dataType);
	var samplerPromise = new Promise(function(resolve,reject){
		//console.log("DEBUG: ReadSamples.Promise", streamType, dataType);
		if(dataType=="") dataType = lslWrapper.getStreamDataTypeSync(streamType);
		if(dataType.substr(0,3)!="ERR"){
			if(dataType==lslWrapper.LSL_TYPE_STRING){				
				streamStatus[streamType].obj.readStringStreamAsync( function(err,sample){
					if(err){
						reject(err);
					}
					else{
						resolve({"streamType":streamType,"dataType":dataType,"sample":sample,"source":streamStatus[streamType].sourceId,"name":streamStatus[streamType].sourceName});					
					}
				});				
			}
			else{
				if(dataType==lslWrapper.LSL_TYPE_FLOAT){
					//console.log("DEBUG: Reading floats",streamStatus[streamType]);
					var res = streamStatus[streamType].obj.readFloatStreamAsync( function(err,sample){
						//console.log("DEBUG: ASYN READ",err, sample);
						if(err){
							reject(err);
						}
						else{
							//console.log("DEBUG: ASYN READ","Resolve" );
							resolve({"streamType":streamType,"dataType":dataType,"sample":sample,"source":streamStatus[streamType].sourceId,"name":streamStatus[streamType].sourceName});				
						}
					});	
				}	
				else{
					console.log("ERR: Unknown datatype encountered in readSamples", dataType);
				}
			}			
		}
		else{
			reject(dataType);			
		}
	});
	samplerPromise.then(
		function(data) {//
			//console.log("DEBUG: samplerPromise THEN", data,streamStatus[data.streamType].continueStream);
			processSample(data);//,data.streamType,streamStatus[data.streamType].continueStream);			
			if(streamStatus[data.streamType].continueStream){
				//console.log("DEBUG: samplerPromise CALL RECURSE", lslWrapper.getStreamNameSync(data.streamType));
				readSamples(data.streamType,data.dataType);
			}
			else{				
				//console.log("DEBUG: samplerPromise THEN EXIT");
				var result = streamStatus[data.streamType].obj.closeInletStreamSync();
				//console.log(result);
				streamStatus[data.streamType].started=false;
			}
		}, 
		function(error) {
			console.log('ERR: samplerPromise rejected with error:', error);
			process.exit();
	}).catch(
		function(error){
			console.log("ERR:", error);
			console.log("ERR: Aborting...");
			process.exit();
		}
	);
}

function processSample(data){//log, record, broadcast, decide closure
	//log
	var str = data.sample.join(", ");
	if(itrCntr%250==0 && streamStatus[data.streamType].sourceName=="EEG") //log to console periodically only, to prevent scroll-bluring of content
		console.log("INFO:",itrCntr,"...",streamStatus[data.streamType].sourceName,str);
	if(itrCntr%2==0 && streamStatus[data.streamType].sourceName=="Quality") //log to console periodically only, to prevent scroll-bluring of content
		console.log("INFO:",itrCntr,"...",streamStatus[data.streamType].sourceName,str);
	
	//record 
	if(recorderObj.record[data.streamType]) //if the record flag is set, write to file
		recordData(data);
	
	//broadcast
	broadCast(data); //send it to the connected WS clients
	
	//decide closure, in case we just want to verify operation, once closed, restart is required
	itrCntr++;
	if(itrCntr>5000 && abortN){//set abortN to false and inlet stream is never closed till application is alive
		streamStatus[data.streamType].continueStream = false;
		console.log("INFO: Closing", data.streamType, lslWrapper.getStreamNameSync(data.streamType));
		console.log("INFO: Restart the Node app to resume inlet stream read");
	}
}


	 
function broadCast(data){//send the sampled data to all consumers
	tcpStatus.lastMsgTimestamp = Date.now(); //update flag to tell when the last LSL message was received and sent across
	//console.log("DEBUG: Broadcasting ",data);
	var json = JSON.stringify(data);
	for (var i=0; i < wsStatus.browserClients.length; i++) {//sent to every single connected client
		wsStatus.browserClients[i].sendUTF(json);
	}	
}	 