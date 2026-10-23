package com.hisaabkitab.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.Executor;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#0D2E14"));
            window.setNavigationBarColor(Color.parseColor("#F3F5F1"));
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                // White clock/battery icons on dark emerald (#0D2E14) status bar
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(true);
            }
        }

        // Prevent WebView from overlapping the top mobile status bar (time/battery) or bottom gesture bar on Android 15+ (SDK 35)
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#0D2E14"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }

        // Register Native Android Hardware Biometric Bridge on the Capacitor WebView
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new AndroidBiometricBridge(), "AndroidBiometric");
        }
    }

    public class AndroidBiometricBridge {

        @JavascriptInterface
        public boolean isAvailable() {
            try {
                BiometricManager bm = BiometricManager.from(MainActivity.this);
                int canAuth = bm.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_WEAK |
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
                if (canAuth == BiometricManager.BIOMETRIC_SUCCESS) {
                    return true;
                }
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                return km != null && km.isDeviceSecure();
            } catch (Exception e) {
                return true;
            }
        }

        @JavascriptInterface
        public void authenticate(final String title, final String subtitle) {
            runOnUiThread(() -> {
                try {
                    Executor executor = ContextCompat.getMainExecutor(MainActivity.this);
                    BiometricPrompt biometricPrompt = new BiometricPrompt(
                        MainActivity.this,
                        executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                                super.onAuthenticationError(errorCode, errString);
                                sendBiometricResult(false, errString.toString());
                            }

                            @Override
                            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                                super.onAuthenticationSucceeded(result);
                                sendBiometricResult(true, null);
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                super.onAuthenticationFailed();
                                // Do not close prompt on single mis-read; Android BiometricPrompt lets user retry
                            }
                        }
                    );

                    BiometricPrompt.PromptInfo promptInfo;
                    try {
                        promptInfo = new BiometricPrompt.PromptInfo.Builder()
                            .setTitle(title != null && !title.isEmpty() ? title : "Funds Logger Biometric Lock")
                            .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Verify Fingerprint, Face Unlock, or PIN")
                            .setAllowedAuthenticators(
                                BiometricManager.Authenticators.BIOMETRIC_WEAK |
                                BiometricManager.Authenticators.DEVICE_CREDENTIAL
                            )
                            .build();
                    } catch (Exception fallbackEx) {
                        promptInfo = new BiometricPrompt.PromptInfo.Builder()
                            .setTitle(title != null && !title.isEmpty() ? title : "Funds Logger Biometric Lock")
                            .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Touch the fingerprint sensor")
                            .setNegativeButtonText("Use Password")
                            .build();
                    }

                    biometricPrompt.authenticate(promptInfo);
                } catch (Exception e) {
                    sendBiometricResult(false, e.getMessage() != null ? e.getMessage() : "Biometric sensor unavailable");
                }
            });
        }

        private void sendBiometricResult(boolean success, String error) {
            runOnUiThread(() -> {
                try {
                    if (getBridge() == null || getBridge().getWebView() == null) return;
                    JSONObject payload = new JSONObject();
                    payload.put("success", success);
                    if (error != null) {
                        payload.put("error", error);
                    }
                    String js = "window.dispatchEvent(new CustomEvent('nativeBiometricResult', { detail: " + payload.toString() + " }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            });
        }
    }
}
