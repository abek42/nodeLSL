package uk.ac.lancs.scc.nodeLSL;
//import edu.ucsd.sccn.LSL;
//import java.io.IOException;

public class ReceiveExample {
    public static void main(String[] args)  {
        System.out.println("INFO: Creating new StreamReaders...");
		
		LSLWrapper eegInputStream = new LSLWrapper();
		//LSLWrapper qltyInputStream = new LSLWrapper();
		//LSLWrapper markerInputStream = new LSLWrapper();
		
		
		eegInputStream.openInletStream(LSLWrapper.LSL_EEG);
		System.out.println("INFO: "+eegInputStream.getInletSourceId());
		System.out.println("INFO: Created new StreamReaders...");//qltyInputStream.openInletStream(LSLWrapper.LSL_QUALITY);
		//markerInputStream.openInletStream(LSLWrapper.LSL_MARKERS);
		System.out.println("INFO: Created new StreamReaders...");
		
		for(int i=0;i<1000;i++){
			float arrE[] = eegInputStream.readFloatStream();
			//float arrQ[] = qltyInputStream.readFloatStream();
			//String arrM[] = LSLWrapper.readStringStream();
			
			System.out.print("\nINFO: EEG -> ");
			for(int j=0;j<arrE.length;j++){
				System.out.print(arrE[j]);
				if(arrE.length-1>j)	System.out.print(", ");
			}
			
			/*
			System.out.print("\nINFO: Quality -> ");
			for(int j=0;j<arrQ.length;j++){
				System.out.print(arrQ[j]);
				if(arrQ.length-1>j)	System.out.print(", ");
			}
			
			
			System.out.print("\nINFO: Markers -> ");
			for(int j=0;j<arrM.length;j++){
				System.out.print(arrM[j]);
			}
			*/			
		}
    }
}