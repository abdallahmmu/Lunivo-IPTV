package com.lunivo.iptv;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.IOException;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private LocalVideoRelayServer relayServer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        relayServer = new LocalVideoRelayServer();
        try {
            relayServer.start();
        } catch (IOException e) {
            Log.e(TAG, "Failed to start local video relay server", e);
        }
    }

    @Override
    public void onDestroy() {
        if (relayServer != null) {
            relayServer.stop();
        }
        super.onDestroy();
    }
}
