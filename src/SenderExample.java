package uk.ac.lancs.scc.nodeLSL;
//import edu.ucsd.sccn.LSL;
//import java.io.IOException;

public class SenderExample {
    public static void main(String[] args) throws InterruptedException  {
		//String name, String streamType, int cntChannels, float frequency, String dataType, String source_id
		LSLWrapper outStream1 = null;
		LSLWrapper outStream2 = null;
		try{
			//String streamName, String streamFor, int cntChannels, float frequency, int streamType, String source_id
			outStream1 = new LSLWrapper("LSLSenderExample.EEG.8.100.F32",LSLWrapper.getStreamName(LSLWrapper.LSL_EEG),
										8,10,LSLWrapper.LSL_EEG,"LSLSenderExample.EEG.8.100.F32");
			outStream2 = new LSLWrapper("LSLSenderExample.MARKERS.1.10.STR",LSLWrapper.getStreamName(LSLWrapper.LSL_MARKERS),
										1,10,LSLWrapper.LSL_MARKERS,"LSLSenderExample.MARKERS.1.10.STR");
		}
		catch(Exception e){
				System.out.println("ERR: Error while creating LSL StreamOutlet ["+"LSLSenderExample.EEG.8.100.F32"+"]");
				e.printStackTrace();
		}
        System.out.println("INFO: Created a new Stream Outlet...");
		float[] samples = new float[8];
		for(int i=0;i<1000;i++){
			for(int j=0;j<samples.length;j++){
				samples[j]= (float)(Math.random()*2.0*400000000.0 - 400000000);
			}	
			if(i%50==0)System.out.println("INFO: Blip-> "+ Integer.toString(i) );
			outStream1.sendSample(samples);
			Thread.sleep(10);
		}
		System.out.println("INFO: Done sending eeg data, closing...");
		
		System.out.println("INFO: Created a new Stream Outlet...");
		String[] samplesStr = new String[1];
		for(int i=0;i<1000;i++){
			samplesStr[0]= Integer.toString((int)Math.random()*100);	
			if(i%50==0)System.out.println("INFO: Blip-> "+ Integer.toString(i) + samplesStr[0] );
			outStream2.sendSample(samplesStr);
			Thread.sleep(10);
		}
		System.out.println("INFO: Done sending eeg data, closing...");
		
		outStream1.closeOutletStream();

    }
}