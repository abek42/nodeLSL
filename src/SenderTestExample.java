package uk.ac.lancs.scc.nodeLSL;
//import edu.ucsd.sccn.LSL;
//import java.io.IOException;

// this example uses the inbuild, non-blocking methods to stream data
public class SenderTestExample {
    public static void main(String[] args)  {
        System.out.println("INFO: Creating a new StreamInfo...");
		LSLWrapper.startTestOutletStream(LSLWrapper.LSL_EEG);
		LSLWrapper.startTestOutletStream(LSLWrapper.LSL_QUALITY);
		LSLWrapper.startTestOutletStream(LSLWrapper.LSL_MARKERS);
		
		Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
			public void run() {
				// what you want to do
					LSLWrapper.stopTestOutletStream(LSLWrapper.LSL_EEG);
					LSLWrapper.stopTestOutletStream(LSLWrapper.LSL_QUALITY);
					LSLWrapper.stopTestOutletStream(LSLWrapper.LSL_MARKERS);
				}
			}));
    }
}