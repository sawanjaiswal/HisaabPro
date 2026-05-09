package com.hisaabpro.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge: tells Android NOT to inset the WebView for the system
        // bars. Combined with the `viewport-fit=cover` meta tag and the
        // `android:fitsSystemWindows="false"` style flag, this lets the
        // WebView see env(safe-area-inset-bottom) as a non-zero value when
        // the gesture pill / 3-button bar is present.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
