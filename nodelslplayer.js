const fs = require("fs");
const net = require('net');
const util= require('util');

const java = require('java');
java.asyncOptions = {
  asyncSuffix: "Async",     // Don't generate node-style methods taking callbacks
  syncSuffix: "Sync"              // Sync methods use the base name(!!) 
}
const path = require('path');
java.classpath.push(path.resolve(__dirname),"examples");
var lslWrapper = java.import('uk.ac.lancs.scc.nodeLSL.LSLWrapper');
var except = java.import('java.io.IOException');

const readline = require('readline');

//var streamer = {rl:null,fName:fileName,fMode:"LOOP",fDone:true, isPlayer:false, channels:8, freq:50};

var timerOn = false;
var hndTCPSocket;
var hndTimer;

const MODE_LOOP = "LOOP";
const MODE_RUNONCE = "ONESHOT";
const TYPE_EEG = "E";
const TYPE_QUALITY = "Q";
const TYPE_MARKERS = "M";
const TYPE_INVALID = "X";

/**************************************
Objectives:
1. Receive stream specifications from command line
2. Receive a file name that will be loaded
3. Receive instructions on loop or straight run / also allow to generate and stream data on the fly
4. Open a LSLWrapper stream and process as per command line instructions

LSLNodeWrapper: -SE/-SQ/-SM send 100 seconds worth samples
LSLNodeWrapper: -CE/-CQ/-CM send samples till interrupted
LSLNodePlayer:  -RE/-RQ/-RM send the contents of a file once
LSLNodePlayer:  -LE/-LQ/-LM send the contents of a file till interrupted
And: -N n -T 0.5 -FILE <FileName>
**************************************/
var playerObj = {rl:null,stream:null,isPlayer:false,streamType:lslWrapper.LSL_EEG,loopMode:MODE_RUNONCE,frequency:-1.0,channels:8,dataType:lslWrapper.LSL_TYPE_FLOAT,fName:"FloatSam.txt", fDone:true,timerHnd:null,blipCtr:0};
var dataBuffer = [];

//------------------------------------------------------//
init();
//------------------------------------------------------//

function init(){//processes command line params
	processArgs();
	//create outlet stream with specifications
	//construct stream name
	openOutletStream();
	if(playerObj.frequency>0){
		playerObj.timerHnd = setInterval(sendData,1000.0/playerObj.frequency,"streamData");
	}
	else{
		playerObj.timerHnd = setTimeout(randomData,Math.random()*500,"blipData");
	}
	
	if(playerObj.isPlayer){
        console.log("INFO: Streaming data from: "+playerObj.fName, "Mode: "+playerObj.loopMode);
        openFileStream(playerObj.fName);
    }
    else{
        console.log("INFO: Server mode, random data being streamed.");
    }
}

function randomData(){
	sendData();
	playerObj.timerHnd = setTimeout(randomData,Math.random()*500,"blipData");
	console.log("blip");
}

function openOutletStream(){
	var streamName= ((playerObj.isPlayer)?"LSLNodePlayer":"LSLNodeWrapper") + (lslWrapper.getStreamNameSync(playerObj.streamType).toUpperCase());
	var streamType = lslWrapper.getStreamNameSync(playerObj.streamType);
	var freqStr = "";
	if(playerObj.frequency<0){
		freqStr = "RAND";
	}
	else{//check if it is a full integer
		if(parseInt(playerObj.frequency.toFixed(0))==playerObj.frequency){//same number, not the best approach but meh!
			freqStr = playerObj.frequency.toFixed(0);
		}
		else{
			freqStr = playerObj.frequency.toFixed(2).replace(".",","); //replace the decimal dot with a comma
		}
	}
	
	var source_id = streamName+"."+playerObj.channels+"."+freqStr+"."+(playerObj.dataType==lslWrapper.LSL_TYPE_FLOAT?"F32":"STR");
	console.log("INFO: Creating outletstream with config:");
	console.log("\t: StreamName: "+ streamName);
	console.log("\t: StreamType: "+ streamType);
	console.log("\t: Channel  #: "+ playerObj.channels);
	console.log("\t: Frequency : "+ playerObj.frequency);
	console.log("\t: Data Type : "+ playerObj.dataType);
	console.log("\t: Source id : "+ source_id);
	//  					java.lang.String,	java.lang.Integer,	java.lang.Integer,	java.lang.String,	java.lang.String)"
	//	String streamName, 	String streamType, 	int cntChannels, 	float frequency, 	String dataType, 	String source_id
	playerObj.stream = java.newInstanceSync("uk.ac.lancs.scc.nodeLSL.LSLWrapper", streamName, streamType, playerObj.channels, 1.0*playerObj.frequency, playerObj.streamType, source_id);
	console.log("INFO: Outlet stream created...");
}

function openFileStream(fName){
    playerObj.rl = readline.createInterface({
        input: fs.createReadStream(fName)
    });

    playerObj.fDone = false;
    
    playerObj.rl.on('line', function(line){
        playerObj.rl.pause(); //stop immediately
        dataBuffer.push(line);
    });
    
    playerObj.rl.on('pause', function(){
        //console.log("File paused", dataBuffer.length);
    });

    playerObj.rl.input.on('end', function(){
        console.log("INFO: File loaded. Pending lines to stream:", dataBuffer.length);    
        playerObj.fDone = true;
        if(playerObj.loopMode!=MODE_RUNONCE && dataBuffer.length==0) openFileStream(playerObj.fName);
    });
    
    playerObj.rl.input.on('close', function(){
        console.log("INFO: File closed. Pending lines to stream:", dataBuffer.length);    
        playerObj.fDone= true;
        if(playerObj.loopMode!=MODE_RUNONCE && dataBuffer.length==0) openFileStream(playerObj.fName);
    });
}

function showHelpText(){
	console.log("INFO: Valid command options are:");

	console.log("\tOne of the following:")
	console.log("\t\t-SE or -SQ or -SM: Send 100 seconds worth samples");		
	console.log("\t\t-CE or -CQ or -CM: Send samples till interrupted");		
	console.log("\t\t-RE or -RQ or -RM: Send the contents of a file once, file needed with -FNAME <filename>");
	console.log("\t\t-LE or -LQ or -LM: Send the contents of a file till interrupted, file needed with -FILE <filename>");    
	console.log("\t\t\tE = EEG, Q = Qualit and M = Markers");
	console.log("In addition to the following:");
	console.log("\t\t-N <numCh>: Number of channels (+ve integer)");
	console.log("\t\t-T <freq>: Frequency (+ve float value). To set a random rate, provide a -ve number");
	console.log("\t\t-FILE <file>: File name containing TAB separated values or Comma separated values. \n\t\t\tOnly if needed (for R<x> and L<x> args)");	
}

function setPlayerMode(isPlayer,loopMode,valx,needFileFlag){
	playerObj.isPlayer = isPlayer;
	playerObj.loopMode = loopMode;
	//determine stream type
	if(setStreamType(valx)==TYPE_INVALID){
		console.log("ERR: Invalid stream type. Expected", TYPE_EEG, "or",TYPE_QUALITY, "or",TYPE_MARKERS, ". Got '",val.substr(1,1),"'");
		return false; //invalid type
	}
	return true;
}

function setStreamType(valx){
	var retVal = TYPE_INVALID;
	switch(valx){
		case TYPE_EEG:
			playerObj.streamType = lslWrapper.LSL_EEG;			
			retVal = TYPE_EEG;
			break;
		case TYPE_MARKERS:
			playerObj.streamType = lslWrapper.LSL_MARKER;
			playerObj.dataType = lslWrapper.LSL_TYPE_STRING;
			retVal = TYPE_MARKERS;
			break;
		case TYPE_QUALITY:
			playerObj.streamType = lslWrapper.LSL_QUALITY;
			retVal = TYPE_QUALITY;
			break;
	}
	return retVal; //for some args, this may be TYPE_INVALID. Only matters in some cases.
}

function stripPrefix(val){
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
	return val2;
}

var offset=1;
var increasing=true;
function sendData(){//this function transmits the data over the connection
	var dBuf=[];
	if(!playerObj.isPlayer){//serving random data		
		for(var i=0;i<playerObj.channels;i++){
			dBuf[i]= playerObj.dataType==lslWrapper.LSL_TYPE_FLOAT?getFloat():getString();
		}
	}
	else{//serving data from file
		if(dataBuffer.length<1){//data buffer is empty
			if(!playerObj.fDone){
				playerObj.rl.resume();
			}
			else{
				console.log("INFO: EOF enountered..." + (playerObj.loopMode==MODE_RUNONCE?"Streaming ended. Restart player":"Looping from start again."));
				if(playerObj.loopMode!=MODE_RUNONCE){
					openFileStream(playerObj.fName);
				}
				else{//time to close out
					console.log("INFO: Closing stream");
					playerObj.stream.closeOutletStreamSync();
					process.exit(0);  //since we don't have good means to restart after a stop, we kill the app            
					return;
				}				    
			}
			return; //skip this iteration
		}
		else{
			var dataLine = dataBuffer.splice(0,1)[0].split("\t"); //gets the first element from the file
			//recorder files are tab separated (can be comma separated too)
			if(dataLine.length!=playerObj.channels){//something went wrong. retry with commas
				dataLine = dataLine[0].split(","); //gets the first element from the file
				if(dataLine.length!=playerObj.channels){
					console.log("ERR: File contents could not be parsed. Failing line: <",dataLine[0],">");
					playerObj.stream.closeOutletStreamSync();
					process.exit(0);
				}
			}
			else{//we have more results, lets convert to numbers
				//we expect 8 numbers only
				for(var i=0;i<dataLine.length;i++){
					dBuf[i]= dataLine[i];//we don't parse it here
				}                
			}
			if(!playerObj.fDone){
			    playerObj.rl.resume(); //pull one more line from the file
			}
		}
	}
//sendSample
	if(playerObj.dataType==lslWrapper.LSL_TYPE_FLOAT){
		try{
			playerObj.stream.sendFloatSamplesSync(java.newArray('java.lang.String', dBuf)); //we hope this will work fine
		}
		catch(e){
			console.log("ERR: FATAL",e);
			console.log(dBuf.length, dBuf);
			process.exit();			
		}
	}
	else{
		playerObj.stream.sendSampleSync(dBuf); //we hope this will work fine
	}
	var blipsPerSecond=Math.floor(playerObj.frequency);
	if(playerObj.frequency<1){
		blipsPerSecond = 1; //every blip is logged
	}
	if(playerObj.blipCtr%blipsPerSecond==0){
		console.log("INFO: ",lslWrapper.getStreamNameSync(playerObj.streamType),dBuf.join(","));
		playerObj.blipCtr = 0;
	}
	playerObj.blipCtr++;
	
}

function getFloat() {//more tbd here
	if(playerObj.streamType==lslWrapper.LSL_EEG)
		return Math.random()*10000-5000.0;
	else
		return Math.random();
}

function getString(){//more tbd here
	return "A";	
}


function processArgs(){
	var args = process.argv.slice(0,process.argv.length); //copy over with slice
	var skipNext = false;
	var needFileName = false;
	var gotFileName = false;
	var isValid=true;
	var showHelp = false;
	for(var i=2;i<args.length;i++){//for each argument
		if(skipNext){//in case the arg is a param of the previou switch
			skipNext = false;
			continue;
		}
		val = stripPrefix(args[i]);
		console.log("Arg:",val);
		switch(val.toUpperCase()){
			case 'SM':
			case 'SE':
			case 'SQ': //stream a randomly generated stream of data for 100s
				isValid &= setPlayerMode(false,MODE_RUNONCE,val.substr(1,1),false);
				break;				
			case 'CE': 
			case 'CQ':
			case 'CM': //stream a randomly generated stream of data till interrupted
				isValid &= setPlayerMode(false,MODE_LOOP,val.substr(1,1),false);
				break;
			case 'RM':
			case 'RE':
			case 'RQ': //stream a given file contents once
				isValid &= setPlayerMode(true,MODE_RUNONCE,val.substr(1,1),true);
				needFileName = true;
				break;				
			case 'LE': 
			case 'LQ': 
			case 'LM': //stream a given file contents till interrupted
				isValid &= setPlayerMode(true,MODE_LOOP,val.substr(1,1),true);
				needFileName = true;
				break;
			case 'N': //number of channels, use next arg
				skipNext = true;
				if((isNaN(parseInt(args[i+1])))&&(parseInt(args[i+1]>0))){ isValid = false; }
				else{	playerObj.channels = parseInt(args[i+1]); }
				break;
			case 'T': //timing or frequency, use next arg, -ve value for random
				skipNext = true;
				if(isNaN(parseFloat(args[i+1]))){ isValid = false; }
				else{ playerObj.frequency = parseFloat(args[i+1]); }
				break;
			case 'FILE': //file name, use next arg
				skipNext = true;
				playerObj.fName = args[i+1];
				gotFileName = true;
				console.log("DEBUG:", gotFileName);
				break;
			case 'H':
			case 'HELP': //show help message
				showHelp = true;
			//	isValid = false;
				break;
			default: //anything else, error!
				isValid = false;
				console.log("ERR: Invalid argument: '"+args[i]+"'");
		}
		
	}
	if((!isValid)||(gotFileName!=needFileName)){
		console.log("ERR: Encountered invalid or insufficient argument(s), aborting...","Got:",gotFileName,"needFileName",needFileName);
		if(gotFileName||needFileName){
			console.log("ERR: Missing filename or unnecessary filename provided");
		}
		showHelpText();
		process.exit(0);
	}
	if(showHelp){
		showHelpText();
		process.exit(0)
	}	
}



