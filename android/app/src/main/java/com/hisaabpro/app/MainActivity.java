package com.hisaabpro.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        // Edge-to-edge layout: must be called before super.onCreate() so Capacitor's
        // setContentView inherits the flag. EdgeToEdge.enable() is the SDK-35+ SSOT.
        EdgeToEdge.enable(this);
        registerPlugin(PhoneNumberHintPlugin.class);
        super.onCreate(savedInstanceState);
        enableThirdPartyCookies();
        applySystemBarStyles();
        setupSafeAreaInsets();
        setupWebViewPageLoadedListener();
    }

    /**
     * Allow the Capacitor WebView to accept cookies set by cross-origin API responses.
     */
    private void enableThirdPartyCookies() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
    }

    private void setupWebViewPageLoadedListener() {
        if (getBridge() == null) return;
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                runOnUiThread(() -> reinjectSafeAreaInsets());
            }
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        applySystemBarStyles();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applySystemBarStyles();
        }
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemBarStyles();
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            wv.post(() -> {
                ViewCompat.requestApplyInsets(wv);
                reinjectSafeAreaInsets();
            });
        }
    }

    private void applySystemBarStyles() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        boolean isNight = (getResources().getConfiguration().uiMode
            & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        controller.setAppearanceLightStatusBars(!isNight);
        controller.setAppearanceLightNavigationBars(!isNight);

        int windowBg = isNight ? 0xFF0F172A : 0xFFFFFFFF;
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(windowBg));
        getWindow().getDecorView().setBackgroundColor(windowBg);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private void setupSafeAreaInsets() {
        final android.view.View contentView = findViewById(android.R.id.content);
        if (contentView == null) return;
        contentView.post(() -> {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                float density = getResources().getDisplayMetrics().density;
                int safeIme = Math.round(ime.bottom / density);
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                int[] dp = effectiveSafeAreaDp(insets, wv, density);
                injectSafeAreaCssVars(wv, dp, safeIme);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentView);
        });
    }

    private static int[] effectiveSafeAreaDp(WindowInsetsCompat insets, WebView webView, float density) {
        Insets display = Insets.max(
            insets.getInsets(WindowInsetsCompat.Type.systemBars()),
            insets.getInsets(WindowInsetsCompat.Type.displayCutout())
        );
        int gapTop = 0, gapBottom = 0, gapLeft = 0, gapRight = 0;
        if (webView != null && webView.getWidth() > 0 && webView.getHeight() > 0) {
            int[] loc = new int[2];
            webView.getLocationOnScreen(loc);
            android.view.View root = webView.getRootView();
            int rootW = root != null ? root.getWidth() : webView.getWidth();
            int rootH = root != null ? root.getHeight() : webView.getHeight();
            gapTop = loc[1];
            gapLeft = loc[0];
            gapBottom = Math.max(0, rootH - (loc[1] + webView.getHeight()));
            gapRight = Math.max(0, rootW - (loc[0] + webView.getWidth()));
        }
        int safeTopPx = Math.max(0, display.top - gapTop);
        int safeBottomPx = Math.max(0, display.bottom - gapBottom);
        int safeLeftPx = Math.max(0, display.left - gapLeft);
        int safeRightPx = Math.max(0, display.right - gapRight);
        return new int[] {
            Math.round(safeTopPx / density),
            Math.round(safeBottomPx / density),
            Math.round(safeLeftPx / density),
            Math.round(safeRightPx / density),
        };
    }

    private boolean reinjectRetried = false;

    private void reinjectSafeAreaInsets() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
        if (insets == null) {
            ViewCompat.requestApplyInsets(webView);
            if (!reinjectRetried) {
                reinjectRetried = true;
                webView.postDelayed(() -> {
                    reinjectRetried = false;
                    reinjectSafeAreaInsets();
                }, 100);
            }
            return;
        }
        reinjectRetried = false;
        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
        float density = getResources().getDisplayMetrics().density;
        int safeIme = Math.round(ime.bottom / density);
        int[] dp = effectiveSafeAreaDp(insets, webView, density);
        injectSafeAreaCssVars(webView, dp, safeIme);
    }

    private void injectSafeAreaCssVars(WebView wv, int[] dp, int safeIme) {
        if (wv == null) return;
        String js = String.format(java.util.Locale.US,
            "document.documentElement.style.setProperty('--safe-top','%dpx');" +
            "document.documentElement.style.setProperty('--safe-bottom','%dpx');" +
            "document.documentElement.style.setProperty('--safe-left','%dpx');" +
            "document.documentElement.style.setProperty('--safe-right','%dpx');" +
            "document.documentElement.style.setProperty('--safe-bottom-ime','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-top','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-bottom','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-left','%dpx');" +
            "document.documentElement.style.setProperty('--safe-area-inset-right','%dpx');",
            dp[0], dp[1], dp[2], dp[3], safeIme, dp[0], dp[1], dp[2], dp[3]);
        runOnUiThread(() -> wv.evaluateJavascript(js, null));
    }
}
