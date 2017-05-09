package uk.ac.lancs.scc.nodeLSL;
import edu.ucsd.sccn.LSL;

public class LSLWrapper {

	//these define the supported stream types.
	public static final int LSL_MARKERS = 0;
	public static final int LSL_EEG = 1;
	public static final int LSL_QUALITY = 2;
	public static final String LSL_TYPE_FLOAT = "Float";
	public static final String LSL_TYPE_STRING = "String";

	//receiver related variables, their usage is wrapped
	private static String[] namedStream;	//these are the 'types' used by LSL.resolve_stream for the supported stream types
	
	private LSL.StreamInlet inlet_Stream; //this holds the reference to the receiver stream
	private boolean inStreamInit; //this holds the state of initialization
	private int inletStreamType;
	private String inletInitMsg;
	private String inletSourceId;
	
	private static boolean outStreamInit[];
	private static ThreadedSender[] outlet_Streams;
	
	private boolean isOutletStream;
	private LSL.StreamInfo 	 outlet_StreamInfo;
	private String outlet_DataType;
	private LSL.StreamOutlet outlet_Stream; //this is the handle to the sender stream
	
	//error status return values
	private static final float[] errFloats = {-1,-1,-1,-1,-1,-1,-1,-1};
	
	static{		
		outStreamInit = new boolean[3];
		outlet_Streams = new ThreadedSender[3];
		
		namedStream = new String[3];
		namedStream[LSL_MARKERS] = "Markers";
		namedStream[LSL_EEG] 	= "EEG";
		namedStream[LSL_QUALITY] = "Quality";
	}
	
	public LSLWrapper(){//create an object with the intention to use it as an inlet stream
		inletStreamType = LSL_MARKERS; //default init
		isOutletStream = false;
	}
	
	//create an object with the intention to use it as an outlet stream
	//String name, String type, int channel_count, double nominal_srate, int channel_format, String source_id
	public LSLWrapper(String streamName){
		this(streamName, "EEG", 8, 10.0f, LSL_EEG, "Nomimonomon");
	}
	
	public LSLWrapper(String streamName, String streamFor, int cntChannels, double frequency, int streamType, String source_id){
		if(cntChannels<1){//check channel count
			System.err.println("ERR: Channel count has to be non-zero positive number: " + Integer.toString(cntChannels));
			System.exit(0);
		}
		if(frequency<=0){//check frequency
			System.err.println("WARN: Frequency is assumed as RAND. Got: " + Double.toString(frequency));
			//System.exit(0);
		}
		if(!validStreamDataType(getStreamDataType(streamType))){//check if streamType is valid
			System.err.println("ERR: Invalid data type " + Integer.toString(streamType));
		}
		else{//valid stream type, get its data type
			outlet_DataType = getStreamDataType(streamType);
		}
		if(streamName.length()==0) streamName = "OutletStream";
		if(streamFor.length()==0) streamFor = "LSLWrapperStream";
		if(source_id.length()==0) source_id = "LSLWrapper.OutStream.F.C.ID";
		//if here, everything is valid
		System.out.println("INFO: Creating outletstream with config:");
		System.out.println("\t:> StreamName: "+ streamName);
		System.out.println("\t: StreamFor: " + streamFor);
		System.out.println("\t: Channel  #: "+ Integer.toString(cntChannels));
		System.out.println("\t: Frequency : "+ Double.toString(frequency));
		System.out.println("\t: Data Type : "+ getStreamDataType(streamType));
		System.out.println("\t: Source id : "+ source_id);
		try{
			int channel_format = (getStreamDataType(streamType)==LSL_TYPE_FLOAT?LSL.ChannelFormat.float32:(getStreamDataType(streamType)==LSL_TYPE_STRING?LSL.ChannelFormat.string:-1));
			//LSL.StreamInfo("LSLNodeWrapper.Markers","Markers",1,LSL.IRREGULAR_RATE,LSL.ChannelFormat.string,"LSLNodeWrapper.MARKER.1.RAND.STR");
			//LSL.StreamInfo("LSLNodeWrapper.Quality","Quality",8,0.5,LSL.ChannelFormat.float32,"LSLNodeWrapper.QUALITY.8.0,5.F32"); 
			outlet_StreamInfo = 
				new LSL.StreamInfo(streamName, streamFor, cntChannels, (frequency<0)?LSL.IRREGULAR_RATE:frequency,channel_format, source_id);
			outlet_Stream = new LSL.StreamOutlet(outlet_StreamInfo);	
			System.out.println("INFO: Outlet Stream open...");
			isOutletStream = true;
		}
		catch(Exception e){
				System.out.println("ERR: Error while creating LSL StreamOutlet ["+streamName+"]");
				e.printStackTrace();
		}		
	}
	
	private void modeCheck(boolean outletFnCall){
		if(outletFnCall&&isOutletStream){
			return; //alright
		}
		if((!outletFnCall)&&(!isOutletStream)){
			return;
		}
		//if here, mixed call
		String errOutMode = "ERR: Inlet-related function called by an outlet object";
		String errInMode  = "ERR: Outlet-related function called by an inlet object";
		System.err.println(isOutletStream?errOutMode:errInMode);
		System.exit(0);
	}
	
	private boolean validStreamDataType(String dataType){
		switch(dataType){
			case LSL_TYPE_FLOAT:
			case LSL_TYPE_STRING:
				return true;
			default:
				return false;
		}
	}
	
	private boolean validStreamType(int streamType){
		switch(streamType){//check if valid type
			case LSL_MARKERS:
			case LSL_EEG:
			case LSL_QUALITY:
				return true;
			default:
				return false;
		}				
	}

	public static String getStreamName(int type){
		switch(type){
			case LSL_MARKERS:
			case LSL_EEG:
			case LSL_QUALITY:
				return namedStream[type];
			default:
				System.out.println("ERR: Unexpected/Unimplemented Stream type requested: " + Integer.toString(type));
				return "ERR: Unexpected/Unimplemented Stream type requested:"+ Integer.toString(type);
		}
	}
	
	public static String getStreamDataType(int type){
		switch(type){
			case LSL_MARKERS:
				return LSL_TYPE_STRING;
			case LSL_EEG:
			case LSL_QUALITY:
				return LSL_TYPE_FLOAT;
			default:
				System.out.println("ERR: Unexpected/Unimplemented Stream type requested: " + Integer.toString(type));
				return "ERR: Unexpected/Unimplemented Stream type requested:"+ Integer.toString(type);
		}		
	}
/*********************************************************************************

	LSL Receivers for Markers, EEG and Quality.
	To add your own streamtypes:
		Add constants below definition of LSL_QUALITY
		Add names to namedStream[] in the static initialization block
		Add handler code to all functions with a switch-case block to 
			handle the newly defined constants.

*********************************************************************************/
	
	public String openInletStream(int streamType){//initialize a single reciever
		modeCheck(false);
		if(inStreamInit){//check if already inited
			System.out.println("WARN: Stream["+namedStream[streamType]+"] already initialized.");
			return "WARN: Stream["+namedStream[streamType]+"] already initialized.";
		}
		if(!validStreamType(streamType)){
			System.err.println("ERR: Unexpected/Unimplemented Stream type requested: " + Integer.toString(streamType));
			return "ERR: Unexpected/Unimplemented Stream type requested";
		}
		//if here, a real uninitialized stream is ready to be initialized
		inletStreamType = streamType;
		return initialize(streamType);		
	}
	
	private String initialize(int streamType){
		//if this is called, the stream is not initialized
		try{
			//System.err.println("DEBUG: "+ namedStream[streamType]);
			LSL.StreamInfo[] results = LSL.resolve_stream("type", namedStream[streamType]);
			inlet_Stream = new LSL.StreamInlet(results[0]); //<-- We expect a single stream on the network. If more are present, edit this code to find more.
			inStreamInit = true;
			inletSourceId = results[0].source_id();
			//System.err.println("DEBUG: Init"+ namedStream[streamType]);
			return "INFO: Initialized " + namedStream[streamType];
		}
		catch(Exception e){
			System.err.println("ERR: LSL Receiver "+  namedStream[streamType] + " could not be started.");
			e.printStackTrace();
			return "ERR: LSL Receiver "+  namedStream[streamType] + " could not be started" + e.toString();
		}		
	}
	
	public String getInletSourceId(){
		return inletSourceId;
	}
	
	public String closeInletStream(){
		modeCheck(false);
		if(inStreamInit){//already init
			inlet_Stream.close();
			inStreamInit = false;
			return "INFO: Closed " + getStreamName(inletStreamType);
		}
		else{
			return "WARN: Stream not open " + getStreamName(inletStreamType);
		}
	}
	
	public float[] readFloatStream(){//read a stream as floats.
		modeCheck(false);
		if(getStreamDataType(inletStreamType)!=LSL_TYPE_FLOAT){//cant read floats from a string stream
			System.err.println("ERR: Cannot read floats from a string stream. Use readStringStream instead");
			return errFloats;
		}
		if(inStreamInit){//if stream is inited, use it
			return readFloats(inlet_Stream);
		}
		else{
			System.err.println("ERR: Initialize stream first using openInletStream");
			return errFloats;
		}
	}
	
	public String[] readStringStream(){//read a stream as strings
		modeCheck(false);
		if(getStreamDataType(inletStreamType)!=LSL_TYPE_STRING){//cant read floats from a string stream
			String err[] = new String[1];
			err[0] ="ERR: Cannot read strings from a float stream. Use readFloatStream or readStringStreamExt instead";
			System.err.println(err[0]);
			return err;
		}
		
		if(inStreamInit){
			return readString(inlet_Stream);
		}
		else{
			System.err.println("ERR: Initialize stream first using openInletStream");
			return parseToString(errFloats);
		}
	}
	
	public String[] readStringStreamExt(){//read a stream as strings even if it is actually a float stream
		modeCheck(false);
		if(!inStreamInit){
			System.err.println("ERR: Initialize stream first using openInletStream");
			return parseToString(errFloats);
		}
		
		if(getStreamDataType(inletStreamType)==LSL_TYPE_FLOAT){//cant read floats from a string stream
			return parseToString(readFloats(inlet_Stream));		
		}
		else{
			if(getStreamDataType(inletStreamType)==LSL_TYPE_STRING){
				return readString(inlet_Stream);
			}		
		}
		//if here, unhandled type found		
		String err[] = new String[1];
		err[0] ="ERR: Cannot read strings from unrecognized stream type-> " + Integer.toString(inletStreamType) ;
		System.err.println(err[0]);
		return err;
	}
	
	private static String[] parseToString(float[] arr){//simple float array to string array conversion
		String arrStr[] = new String[arr.length];
		for(int i=0; i<arr.length; i++){
			arrStr[i] = Float.toString(arr[i]);
		}
		return arrStr;
	}
	
	private static float[] readFloats(LSL.StreamInlet inlet){
		try{
			float[] samples = new float[inlet.info().channel_count()]; //one 'record'
			inlet.pull_sample(samples);
			return samples;
		}
		catch(Exception e){
				System.out.println("ERR: Error in LSL read stream");
				e.printStackTrace();
				return errFloats;
		}
	}
	
	private static String[] readString(LSL.StreamInlet inlet){
		try{
			String[] sample = new String[1];
			inlet.pull_sample(sample);
			return sample;
		}
		catch(Exception e){
				System.out.println("ERR: Error in LSL read stream");
				e.printStackTrace();
				return parseToString(errFloats);
		}
	}

/*********************************************************************************

	Functions to support externally sourced outlet streams

*********************************************************************************/
	public void sendSample(String[] samples){
		modeCheck(true);
		//System.out.println("INFO: Outputting sample string");
		if(outlet_DataType!=LSL_TYPE_STRING){
			System.err.println("ERR: Stream doesn't support string data type");
			return;
		}
		outlet_Stream.push_sample(samples);
	}
	
	public void sendFloatSamples(String[] samples){//this is required since the node-java wrapper cannot handle arrays gracefully
		modeCheck(true);
		if(outlet_DataType!=LSL_TYPE_FLOAT){
			System.err.println("ERR: Stream doesn't support float data type. Current data type is: "+ outlet_DataType);
			return;
		}
		float[] floats = new float[samples.length];
		for(int i=0;i<samples.length;i++){
			floats[i] = Float.parseFloat(samples[i]);//(float)samples[i];
		}
		outlet_Stream.push_sample(floats);
	}
	
	public void sendSample(float[] samples){
		modeCheck(true);
		//System.out.println("INFO: Outputting sample float");
		if(outlet_DataType!=LSL_TYPE_FLOAT){
			System.err.println("ERR: Stream doesn't support float data type. Current data type is: "+ outlet_DataType);
			return;
		}
		outlet_Stream.push_sample(samples);
	}
	
	public void closeOutletStream(){
		modeCheck(true);
		outlet_Stream.close();
		outlet_StreamInfo.destroy();
	}
/*********************************************************************************

	LSL Outlet Streams for Testing Markers, EEG and Quality without additional code
	These Outlet Streams are configured as threads and thus they don't block
	To add your own streamtypes:
		Add constants below definition of LSL_QUALITY
		Add names in the static initialization block
		Implement other functions are required

*********************************************************************************/	
	//call this function to start a test stream
	public static void startTestOutletStream(int streamType){//starts a test stream 
		switch(streamType){
			case LSL_MARKERS:
			case LSL_EEG:
			case LSL_QUALITY:
				if(outStreamInit[streamType]){//already init
					System.out.println("WARN: Stream["+namedStream[streamType]+"] already initialized.");
					return; // "WARN: Stream["+namedStream[streamType]+"] already initialized.";
				}
				break;
			default:
				System.out.println("ERR: Unexpected/Unimplemented Stream type requested: " + Integer.toString(streamType));
				return; // "ERR: Unexpected/Unimplemented Stream type requested";
		}
		
		if(!outStreamInit[streamType]){
			outlet_Streams[streamType] = new ThreadedSender(streamType);
			outlet_Streams[streamType].start();
		}
		else{
			System.out.println("WARN: The outlet stream " + namedStream[streamType] + " is already initialized");
		}
	}	
	
	public static void stopTestOutletStream(int streamType){//stops the test stream
		if(outStreamInit[streamType]){
			outlet_Streams[streamType].abort();		
		}		
	}
    
	//we use a threaded approach to run the senders
	//these are similar to the send examples in the original LSL/Java implementation
	private static class ThreadedSender extends Thread{
		private LSL.StreamInfo info;
		private LSL.StreamOutlet outlet;
		private volatile boolean runThread;
		private int threadStreamType;
		private enum StrDataType {FLOAT, STRING};
		private StrDataType threadStreamDataType;
		private int markerItr;
		private double blipRate; //this is inverse of the hz (nominal rate) used in StreamInfo init
		
		public ThreadedSender(int streamType){			
			super(namedStream[streamType]);	
			
			String streamName = namedStream[streamType];
			
			markerItr = 0;
			runThread = false;
			try{
				System.out.println("INFO: Creating new " +streamName + " StreamInfo...");
				
				threadStreamType = streamType;				
				info = getNamedStreamInfo(streamType);
			
				System.out.println("INFO: Creating new " +streamName + " outlet...");
				outlet = new LSL.StreamOutlet(info);
				outStreamInit[streamType] = true;
				runThread = true;
			}
			catch(Exception e){
				System.out.println("ERR: Error while creating LSL StreamOutlet ["+streamName+"]");
				e.printStackTrace();
			}
		}
		
		public void abort(){
			runThread  = false; //set to false to kill either in next iteration
			System.out.println("WARN: Termination called for "+ getName());
			interrupt();
		}
		
		public void run(){
			if(!runThread){//if stream inits failed, exit right away
				System.out.println("WARN: Thread for " + getName() + " could not be started");
				return; 
			}
			System.out.println("INFO: Sending data for " + getName() + "...");
			float[] sample = new float[8];
			for (int t=0;t<1000;t++) {
				if(!runThread){ //exit logic
					System.out.println("INFO: Thread for " + getName() + " stopped as instructed");
					return;
				}		
				if(t%10==0) System.out.println("INFO: Blip " + getName() + " -> " + Integer.toString(t));
				try{//the wait 
					switch(threadStreamDataType){//based on stream type, push data
						case FLOAT:
							outlet.push_sample(getFloats(t)); 
							sleep((long)(blipRate>0?blipRate:Math.random()*2000));
							break;
						case STRING:
							outlet.push_sample(getStrings()); 
							sleep((long)(blipRate>0?blipRate:Math.random()*2000));
							break;						
					}
				}
				catch(InterruptedException e){//handle the IE
					System.out.println("WARN: Thread for "+ getName()+" interrupted");
					runThread = false; //set it to exit with stop message
				}
			}        
			outlet.close();
			info.destroy();
			outStreamInit[threadStreamType] = false; //reset the init flag
			System.out.println("INFO: Closed output stream " + getName() + "...");			
		}
		
		private float[] getFloats(int t){
			float[] sample = new float[8];
            for (int k=0;k<8;k++){
				if(getName()==namedStream[LSL_EEG]){//enobio -400000000  to +400000000 
					sample[k] = (float)(Math.random()*2.0*400000000.0 - 400000000);
				}
				else{//assuming quality, enobio is 0 to 1.0
					sample[k] = (float)Math.random();
				}                
			}
			sample[0] = t;
			return sample;
		}
		
		private String[] getStrings(){
			String[] strings = {"MA","MB","MC"};
			String[] sample = new String[1];
			sample[0] = strings[markerItr%3];
			markerItr++;
			return sample;
		}
		
		private LSL.StreamInfo getNamedStreamInfo(int streamType){
			switch(streamType){
				case LSL_EEG:
					threadStreamDataType = StrDataType.FLOAT;
					blipRate = 1000.0/200.0; //normal ENOBIO is 500Hz, we simulate at 200Hz.
					//String name, String type, int channel_count, double nominal_srate, int channel_format, String source_id
					return new LSL.StreamInfo("LSLNodeWrapper.EEG","EEG",8,200,LSL.ChannelFormat.float32,"LSLNodeWrapper.EEG.8.200.F32");
				case LSL_MARKERS:
					threadStreamDataType = StrDataType.STRING;
					blipRate = -1.0; //this is irregular so, we don't set it here
					return new LSL.StreamInfo("LSLNodeWrapper.Markers","Markers",1,LSL.IRREGULAR_RATE,LSL.ChannelFormat.string,"LSLNodeWrapper.MARKER.1.RAND.STR");
				case LSL_QUALITY:
					threadStreamDataType = StrDataType.FLOAT;
					blipRate = 1000.0/0.5; //we expect updates every 2s 
					return new LSL.StreamInfo("LSLNodeWrapper.Quality","Quality",8,0.5,LSL.ChannelFormat.float32,"LSLNodeWrapper.QUALITY.8.0,5.F32"); 
			}	
			return null; //we expect this function call to be passed the three above ones only
		}		
	}//end ThreadedSender
			
}
