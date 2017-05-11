var hndWS = {handle:null,comSel:false, lastStatus:null, wsAddress:"ws://localhost:1337",  timerHnd:null, msgDigested:true};
const SIGNALMULT =0.0005; // 0.00000005; //for ENOBIO8 
var lslSources=[];
var mruLSLSources=[]; //most recent sources
var mruEEG; //most recent EEG sample
const BLIPINTERVAL = 50; //20 times a second
var blipCtr = 0;

//this assumes an 8 channel system. If more channels are needed, the canvas code needs edits and the eegPlotter needs more named arrays (ch9, ch10... etc)
var eegPlotter = {"canvasCtx":null, "ch1":[], "ch2":[], "ch3":[], "ch4":[], "ch5":[], "ch6":[], "ch7":[], "ch8":[], itr:0, lastSample:null, lastQuality:null, lastSampleAt:Date.now(), lastQSampleAt:Date.now(),markers:[],newMarker:false};

var qualityData = {"q1":[-1,-1,-1,-1,-1,-1,-1,-1],"q2":[-1,-1,-1,-1,-1,-1,-1,-1],"q3":[-1,-1,-1,-1,-1,-1,-1,-1],"q0":[-1,-1,-1,-1,-1,-1,-1,-1],"qItr":0};

//these need to be changed to match what is used in your test protocol
var electrodeMap = ["C3", "C4", "Fz", "Pz", "Fp1", "Fp2", "O1", "O2"];					 

//these are all the electrodes available in EEG.svg, the code sets the opacity to 0 for the ones not present in electrodeMap
var eegElectrodes = ["A1", "A2", "C3", "C4", "Cz", "F3", "F4", "F7", "F8", "Fp1",
					 "Fp2","Fz", "O1", "O2", "P3", "P4", "Pz", "T3", "T4", "T5", "T6"];

var qualityGradient = ["#00ff00","#ffc000","#ff0000"];
					 
var commStyle = {outerNIC: "fill:#554400;", outerT2W: "fill:#445500;", outerVIS: "fill:#003380;", outerOFF: "fill:#666666",
				 innerNIC: "fill:#ffcc00" , innerT2W: "fill:#aad400;", innerVIS: "fill:#5599ff;", innerOFF: "fill:#cccccc"
				};

var svgLoaded = false;

//handle all the websocket initialization crap
function WebSocketInit(hnd){
	if ("WebSocket" in window){
		console.log("INFO: WebSocket is supported by your Browser!");
		if(hndWS.lastStatus==null){
			setCommStatus("WSDisconnect");
		}
		
		// Let us open a web socket
			//setCommStatus("WSConnRequest");
			try{
				var ws = new WebSocket(hndWS.wsAddress);
				ws.onerror = function (evt){
					setCommStatus("WSDisconnect");
				}
				ws.onopen = function(){
				// Web Socket is connected, send data using send()
					ws.send("INIT");
					console.log("INFO: WebSocket INIT");
				};

				ws.onmessage = function (evt){ 
					if(hndWS.msgDigested){
						//hndWS.msgDigested=true; //we drop packets if we get them faster than we can process them
						var recvdJSON = evt.data;
						//console.log("WS: Data received", evt.data);
						processJSON(recvdJSON);
					}
				};

				ws.onclose = function(){
					// websocket is closed.
					console.log("ERROR: Websocket Connection Closed");
					logDataToDiv("{\"error\":\"Websocket disconnected\"}");
					window.setTimeout(function(){
						logDataToDiv("{\"error:\"Reconnecting websocket\"}");
						WebSocketInit(hndWS);
					}, 5000);
					setCommStatus("WSDisconnect");
					setEEGGrey();
				};
				hnd.handle = ws; //reference to the actual websocket			
			}
			catch(e){
				setCommStatus("WSDisconnect");
			}
	}            
	else{
		// The browser doesn't support WebSocket
		alert("WebSocket NOT supported by your Browser!");
	}
	
	window.onbeforeunload = function(){
		ws.close();
	}
}

function initALL(){
	checkForRemoteHost(); //check if this page loaded on a remote browser. If so, websocket address needs updating
	WebSocketInit(hndWS);// initialize the websocket connection
	hndWS.send = function(data){//wrap the send command
		switch(hndWS.handle.readyState){
		case 1: //ready to go, send data
			hndWS.handle.send(data); break;
		case 2: //closing handshake
		case 0: //not established
			console.log("TBD: Wait timeout and retrigger send data", data );
			break;
		case 3: //closed or unopened
			console.log("ERROR: Websocket Connection is closed. Re-establishing connection");
			WebSocketInit(hndWS);
		}
	}
	document.getElementById("reload").innerHTML =JSON.stringify(Date()).split("+")[0];
	eegPlotter.canvasCtx = document.getElementById("canvasPlot").getContext("2d");
	initAndDrawEEGPlot();
	var svgHnd = document.getElementById('qualitysvg');
	if(hndWS.timerHnd===null) hndWS.timerHnd = setInterval(updateOnBlip, BLIPINTERVAL, 'plotterAnimation');
	if(svgHnd!=null){
		svgLoaded = true;
		hideUnusedEEGElectrodes();
	}
	
	svgHnd.addEventListener("load",function(){
		svgLoaded = true;		
		hideUnusedEEGElectrodes();
		console.log("WARN: Late load",svgLoaded);		
	},false);
}

function initAndDrawEEGPlot(){
	
	//preload the counters
	eegPlotter.qSamples = [[-1,-1,-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1,-1,-1],[-1,-1,-1,-1,-1,-1,-1,-1]];
	for(var i=0;i<70;i++){//
		//var j=i*7;
		eegPlotter.ch1.push(20);//increments of 40 after the first one
		eegPlotter.ch2.push(60);
		eegPlotter.ch3.push(100);
		eegPlotter.ch4.push(140);
		eegPlotter.ch5.push(180);
		eegPlotter.ch6.push(220);
		eegPlotter.ch7.push(260);
		eegPlotter.ch8.push(300);
	}	
	drawEEGPlot();
}
var ofx=25; var ofy = 25;
function drawEEGPlot(){
	var context = eegPlotter.canvasCtx;
	context.clearRect(0, 0, 550, 320); //clear the whole area
	
	//redraw the lines
	context.beginPath();
	context.strokeStyle = '#000000';
	for(var i=1;i<70;i++){//main channel scribbles
		context.moveTo((i-1)*7,eegPlotter.ch1[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch1[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch2[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch2[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch3[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch3[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch4[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch4[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch5[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch5[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch6[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch6[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch7[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch7[ i ]);
		context.moveTo((i-1)*7,eegPlotter.ch8[i-1]);
		context.lineTo((i  )*7,eegPlotter.ch8[ i ]);
	}
	context.stroke();//end main scribbles
	
	//draw the base-lines 
	context.beginPath();
		context.strokeStyle = '#dddddd';
		context.moveTo(0,20);
		context.lineTo(490,20);
		context.moveTo(0,60);
		context.lineTo(490,60);
		context.moveTo(0,100);
		context.lineTo(490,100);
		context.moveTo(0,140);
		context.lineTo(490,140);
		context.moveTo(0,180);
		context.lineTo(490,180);
		context.moveTo(0,220);
		context.lineTo(490,220);
		context.moveTo(0,260);
		context.lineTo(490,260);
		context.moveTo(0,300);
		context.lineTo(490,300);
	context.stroke();
	
	//draw the moving line
	context.beginPath(); //draw the moving line
		context.strokeStyle = '#0000ff';
		context.moveTo(eegPlotter.itr*7,  0);
		context.lineTo(eegPlotter.itr*7,320);
	context.stroke();
	

	//redraw the text indicators
	var qVals = eegPlotter.lastQuality;
	if(qVals===null){
		qVals = [-1,-1,-1,-1,-1,-1,-1,-1];
	}
	
	context.font = "14px Verdana";
	context.textAlign = "left";
	for(var i=0;i<electrodeMap.length;i++){		
		//console.log(qVals[i],(qVals[i]==-1)?"#dddddd":((qVals[i]<=0.5)?"#00ff00":((qVals[i]<=0.8)?"#ffc000":"#ff0000")));
		context.fillStyle = "#000000";
		context.fillRect(470,i*40, 35,22);
		context.fillStyle = (qVals[i]==-1)?"#c0c0c0":((qVals[i]<=0.5)?"#00ff00":((qVals[i]<=0.8)?"#ffc000":"#ff0000"));
		context.fillText(electrodeMap[i], 472, 16+i*40); 		
	}
	//draw the marker lines
	context.beginPath();
		context.strokeStyle ='#B22222'; //firebrick
		context.fillStyle   ='#B22222'; //firebrick
		for(var i=0;i<eegPlotter.markers.length;i++){//  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
			if(!(eegPlotter.markers[i]===null)){
				context.moveTo(i*7,0);
				context.lineTo(i*7,320);
				context.fillText(eegPlotter.markers[i], i*7+3,10);
			}			
		}
	context.stroke();	
}

function updateOnBlip(){//animates the plotter	
	for(var i=0;i<lslSources.length;i++){
		var active = false;
		for(var j=0;j<mruLSLSources.length;j++){
			if(mruLSLSources[j]==lslSources[i]){
				active = true; break;
			}
		}
		if(active)
			document.getElementById(lslSources[i]).className="fadeInSignal";
		else	
			document.getElementById(lslSources[i]).className="fadeOutSignal";
	}	
	
	//this hacky approach is needed for the nice blipping animation of the active signals
	blipCtr = (blipCtr+1)%20;
	if(blipCtr ==0){
		mruLSLSources.splice(0,mruLSLSources.length);	
	}
	
	//going with enobio, +400000000 -> 20 
	//step 1, eegPlotter.lastSample is latest 8 values, update the 8 with them
	var itr = eegPlotter.itr;
	if(Date.now()-eegPlotter.lastSampleAt>1000){//zero-out last sample if loss of signal occurs
		eegPlotter.lastSample = [0,0,0,0,0,0,0,0];
	}
	if(Date.now()-eegPlotter.lastQSampleAt>3000){//zero-out last sample if loss of signal occurs
		//console.log("QReset");
		eegPlotter.lastQuality = null;
		//setQuality()
	}
	else{//we got a qsample in time, we need to do a bit of a hacky calculation because ENOBIO quality data is inconsistent with the NIC2.0 UI
		
	}
	var ls = eegPlotter.lastSample;
	if(ls===null) return;
	eegPlotter.ch1[itr] = ( 20-ls[0]*SIGNALMULT).toFixed(0);
	eegPlotter.ch2[itr] = ( 60-ls[1]*SIGNALMULT).toFixed(0);
	eegPlotter.ch3[itr] = (100-ls[2]*SIGNALMULT).toFixed(0);
	eegPlotter.ch4[itr] = (140-ls[3]*SIGNALMULT).toFixed(0);
	eegPlotter.ch5[itr] = (180-ls[4]*SIGNALMULT).toFixed(0);
	eegPlotter.ch6[itr] = (220-ls[5]*SIGNALMULT).toFixed(0);
	eegPlotter.ch7[itr] = (260-ls[6]*SIGNALMULT).toFixed(0);
	eegPlotter.ch8[itr] = (300-ls[7]*SIGNALMULT).toFixed(0);
	if(!eegPlotter.newMarker){//is old marker at this itr idx, clear it
		eegPlotter.markers[itr]=null;
	}
	else{
		eegPlotter.newMarker =false; //reset it
	}
	drawEEGPlot();
	eegPlotter.itr =(itr+1)%70; //increment itr for the next run
	
	//also set the scrollTop
	if(eegPlotter.itr%10==0){
		var hnd = document.getElementById("console");
		hnd.scrollTop = hnd.scrollHeight;
	}
	
	//now draw an eeg plot
	//if()
}

function addLSLSourceBlippers(newRawSource){
	var spanHnd = document.createElement("span");
	spanHnd.setAttribute("id",newRawSource);
	spanHnd.className="fadeSignal";
	spanHnd.innerHTML = newRawSource;
	document.getElementById("lslSources").appendChild(spanHnd);
}

function hideUnusedEEGElectrodes(){
	var activeElectrodes = electrodeMap.join("#");
	var svgHnd = document.getElementById('qualitysvg').contentDocument;
	for(var i=0;i<eegElectrodes.length;i++){
		var currElectrode = eegElectrodes[i];
		if(activeElectrodes.indexOf(currElectrode,0)<0){
			svgHnd.getElementById("g"+currElectrode).style="opacity:0.0";
		}
	}
	
}

function processJSON(data){
	logDataToDiv(data);
	var json = JSON.parse(data);
	setCommStatus(json.source);
	setQuality(json);
	blipCheck(json);
	hndWS.msgDigested = true; //reset it to process the next WS packet
}

function blipCheck(json){
	var found = false;
	for(var i=0;i<lslSources.length;i++){//check if this ever came through
		if(lslSources[i]==hndWS.rawSource){//has appeared before
			found = true; break;
		}
	}
	if(!found){ //new, add to full list
		addLSLSourceBlippers(json.source);
		lslSources.push(json.source);
		mruLSLSources.push(json.source);
	}
	else{//not new, already exists
		found = false;
		for(var i=mruLSLSources.length;i>=0;i--){
			if(mruLSLSources[i]==json.source){
				found = true; break;
			}
		}
		if(!found){
			mruLSLSources.push(json.source);
		}
	}
	//save the last sample
	if(json.name=="EEG") {
		eegPlotter.lastSample = json.sample;
		eegPlotter.lastSampleAt = Date.now();
	}
	if(json.name=="Quality"){
		//eegPlotter.lastQuality = json.sample;
		eegPlotter.lastQSampleAt = Date.now();
		
	}
	if(json.name=="Markers"){
		if(eegPlotter.markers[eegPlotter.itr]===null){//new one...
			eegPlotter.markers[eegPlotter.itr] = (json.sample.length==1)?json.sample[0]:"[...]";
		}
		else{//more within this blip
			eegPlotter.markers[eegPlotter.itr] = "[...]";
		}
		eegPlotter.newMarker = true;//so we know this is new, reset by the blipping function
	}
}

function setQuality(json){
	//console.log(json);
	if(json.name=="Quality"){
		//convert the samples data into an array
		var arr = qualityData["q"+qualityData.qItr];
		for(var i=0;i<8;i++){
			arr[i] = json.sample[i];
		}
		
		qualityData.qItr = (qualityData.qItr+1)%4;
		//for the current sample, we pick min values from the last 4 samples
		var arr0 = qualityData.q0;
		var arr1 = qualityData.q1;
		var arr2 = qualityData.q2;
		var arr3 = qualityData.q3;
		var arrRes = [];
		for(var i=0;i<8;i++){
			arrRes[i] = Math.min(arr0[i],Math.min(arr1[i],Math.min(arr2[i],arr3[i])));
		}
		eegPlotter.lastQuality = arrRes;
		//console.log(arrRes,qualityData.qItr);
		var svgHnd = document.getElementById('qualitysvg').contentDocument;
		for(var i=0;i<electrodeMap.length;i++){
			var currElectrode = electrodeMap[i];
			var signal = eegPlotter.lastQuality[i];//json.sample[i];
			svgHnd.getElementById(currElectrode).style=getQualityStyle((typeof(signal)==="undefined")?1.0:signal);
		}		
	}
	else{
		if(json.name=="Keep Alive"){
			setEEGGrey();
		}
	}

}

function setEEGGrey(){
	var svgHnd = document.getElementById('qualitysvg').contentDocument;
	for(var i=0;i<eegElectrodes.length;i++){
		var currElectrode = eegElectrodes[i];
		svgHnd.getElementById(currElectrode).style="fill:#cccccc";
	}
}

function logDataToDiv(data){
	var hnd = document.getElementById("console");
	var str = hnd.innerHTML.split("<br>");
	
	//var test = JSON.parse(data);
	
	//str.push(JSON.stringify(test.data));
	str.push(data);
	if(str.length>10) str.splice(0,str.length-10);
	var strNew = "";
	//var iStr ="";
	
	for(var i=0;i<str.length;i++){
		strNew += (i>0?"<br>":"") 
		strNew +=(str[i]);
		//iStr+=","+str[i].length;
	}
	//console.log(str.length, iStr);
	hnd.innerHTML = strNew;
	//hnd.scrollTop = hnd.scrollHeight;
}

function setCommStatus(source){
	var commSvg = document.getElementById('comm');
	if(commSvg==null) return;
	var compareSrc = transformSource(source);//process it to extract base details
	hndWS.rawSource = compareSrc.rawSource; //we clump a few source types
	if(compareSrc.source==hndWS.lastSource) return; //no change, go back
	
	//console.log("INFO:",source);
	hndWS.lastSource = compareSrc.source; //set it for future reference.
	
	var commHnd = commSvg.contentDocument;
	//NE-ENOBIO8 (00:07:80:0F:63:3C)
	switch(compareSrc.source){
		case "LSLNodeServer": //socket working, no stream yet, keep alive messages present
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerOFF;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerOFF;
			
			commHnd.getElementById("linkBridge").style	=	commStyle.innerOFF;			
			commHnd.getElementById("circleBridge").style=	commStyle.outerT2W;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerT2W;

			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			
			commHnd.getElementById("txtNIC").textContent = "---";	
			break;
		case "LSLNodeWrapper":	//
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerNIC;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerNIC;
			
			commHnd.getElementById("linkBridge").style	=	commStyle.innerT2W;			
			commHnd.getElementById("circleBridge").style=	commStyle.outerT2W;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerT2W;

			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			
			commHnd.getElementById("txtNIC").textContent = "LNW"; //data from the LSLNodeWrapper generating random data
			break;
		case "LSLNodePlayer":	
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerNIC;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerNIC;
			
			commHnd.getElementById("linkBridge").style	=	commStyle.innerT2W;			
			commHnd.getElementById("circleBridge").style=	commStyle.outerT2W;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerT2W;

			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			
			commHnd.getElementById("txtNIC").textContent = "REC"; //data from a recorded data file
			break;
		case "NE-ENOBIO8":	
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerNIC;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerNIC;
			
			commHnd.getElementById("linkBridge").style	=	commStyle.innerT2W;			
			commHnd.getElementById("circleBridge").style	=	commStyle.outerT2W;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerT2W;

			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			
			commHnd.getElementById("txtNIC").textContent = "NIC"; //data from a recorded data file
			break;
		case "WSDisconnect"://everything excluding vis is off
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerOFF;
			commHnd.getElementById("circleBridge").style=	commStyle.outerOFF;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerOFF;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerOFF;
			commHnd.getElementById("linkBridge").style	=	commStyle.innerOFF;			
			commHnd.getElementById("linkVis").style		=	commStyle.innerOFF;
			
			commHnd.getElementById("txtNIC").textContent = "---";	
			break;
		case "Unknown"://only keep alive is coming through,nic off, t2wBridge off, t2w onwards all on
		case "Not Available"://t2wBridge is still trying to connect
		case "TCP Host Unavailable":
			commHnd.getElementById("circleNIC").style 	=	commStyle.outerOFF;
			commHnd.getElementById("circleBridge").style=	commStyle.outerT2W;
			commHnd.getElementById("inCirNIC").style	=	commStyle.innerOFF;
			commHnd.getElementById("inCirBridge").style	=	commStyle.innerT2W;
			commHnd.getElementById("linkBridge").style	=	commStyle.innerOFF;			
			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			break;

		case "WSConnRequest":
			commHnd.getElementById("linkVis").style		=	commStyle.innerVIS;
			break;
		default:
			console.log("ERROR: Unknown state: ",source);		
	}	
	commHnd.getElementById("circleVis").style=	commStyle.outerVIS;
	commHnd.getElementById("inCirVis").style =	commStyle.innerVIS;
}

function transformSource(source){
	//here we strip out extra information and focus on the data that matters
	//e.g. source could be :
	//0. WSDisconnect -> Websocket disconnected and possibly LSLNodeServer is not available
	//1. LSLNodeServer -> Websocket connection established with LSLNodeServer but server hasn't found a LSL Stream
	//2. LSLNodeWrapper -> WS established, LSLNodeServer found a stream generated by LSLNodeWrapper (either through SendExample.java or nodeLSLPlayer with -S<x> or -C<x> flag)
	//3. LSLNodePlayer -> WS established, LSLNodeServer found a recorded stream replayed by LSLNodePlayer (through nodeLSLPlayer with -R<x> or -L<x> flag)
	//4. NE-ENOBIO8 (xx:xx:xx:xx:xx:xx) -> WS established, LSLNodeServer has found an NIC LSL Stream from an ENOBIO8 device
	//add your own as required and update the switch block for setCommStatus
	var ts = {"rawSource":source,"source":source}; //start with basics
	
	if(ts.rawSource.substr(0,10)=="NE-ENOBIO8"){
		ts.source = "NE-ENOBIO8";
		return ts;
	}
	if(ts.rawSource.substr(0,14)=="LSLNodeWrapper"){
		ts.source = "LSLNodeWrapper";
		return ts;
	}
	if(ts.rawSource.substr(0,13)=="LSLNodePlayer"){
		ts.source = "LSLNodePlayer";
		return ts;
	}
	if((ts.rawSource=="LSLNodeServer")||(ts.rawSource=="WSDisconnect")){
		return ts;
	}
	if(ts.rawSource.substr(0,16)=="LSLSenderExample"){
		ts.source = "LSLSenderExample";
		return ts;
	}
	console.log("WARN: Unhandled new source->", source);
	return ts; //for all other options
}

function getQualityStyle(value){// from the Enobio v2.0 manual
//uugreen (QI: 0.0 - 0.5) uuorange (QI: 0.5 - 0.8) uured (QI: 0.8 - 1.0)
	if(value <=0.5) return "fill:"+ qualityGradient[0];
	else{
		if(value<=0.8) return "fill:"+ qualityGradient[1];
		else{
			return "fill:"+ qualityGradient[2];
		}
	}
	return "fill:#dddddd";
}

function changeWSAddress() {
    var wsSplit = hndWS.wsAddress.split(":");
    var wsAddrOld = wsSplit[1].split("//")[1];
    var wsAddressNew = prompt("Provide new IP Address:", wsAddrOld);
    var wsPortOld = wsSplit[2];
    if (wsAddressNew != null) {
        wsPortNew = prompt("Provide new Port number (1-65535)", wsPortOld);
        var chkAddress = wsAddressNew.toLowerCase()=="localhost"?"127.0.0.1":wsAddressNew;
        if(validateIpAndPort(chkAddress+":"+wsPortNew)){
            alert("WebSocket updated to: " + wsAddressNew+":" + wsPortNew);
            hndWS.wsAddress = "ws://" + (wsAddressNew) + ":" + wsPortNew;
            console.log("INFO: Websocket Address>",hndWS.wsAddress);
            document.getElementById("wsAddress").innerHTML = hndWS.wsAddress;
            hndWS.handle.close();
        }
        else{
            alert("WebSocket not updated. Try again.");
        }
    }
}

function validateIpAndPort(input) {
    var parts = input.split(":");
    var ip = parts[0].split(".");
    var port = parts[1];
    console.log(input, parts, ip, port);
    return validateNum(port, 1, 65535) &&
        ip.length == 4 &&
        ip.every(function (segment) {
            return validateNum(segment, 0, 255);
        });
}

function validateNum(input, min, max) {
    var num = +input;
    return num >= min && num <= max && input === num.toString();
}

function checkForRemoteHost(){
	if(window.location.href.toLowerCase().indexOf("localhost")>0) return; //connected to localhost so websockets to localhost too.
	//apparently we are on a remotely hosted page.
	var newWSAddress = "ws:"+(window.location.href.split(":")[1]+":1337/");
	hndWS.wsAddress = newWSAddress;
	document.getElementById("wsAddress").innerHTML = hndWS.wsAddress;
	console.log("INFO: Updated WS Address to Remote:",newWSAddress);
}