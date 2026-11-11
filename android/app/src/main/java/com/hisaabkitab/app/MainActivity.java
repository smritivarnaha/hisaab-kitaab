package com.hisaabkitab.app;

import android.Manifest;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.concurrent.Executor;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final String PREFS_NAME = "FundsLoggerSecurityPrefs";
    private static final String KEY_BIO_ENABLED = "biometric_lock_enabled";
    private static final long BACKGROUND_RELOCK_MS = 3000; // Re-lock after 3s in background like WhatsApp
    private static final int REQ_RECORD_AUDIO_SPEECH = 7701;

    private FrameLayout nativeLockOverlay;
    private boolean isSessionUnlocked = false;
    private boolean isPromptShowing = false;
    private long lastBackgroundTimestamp = 0;

    // Native OS SpeechRecognizer state
    private SpeechRecognizer nativeSpeechRecognizer = null;
    private String pendingSpeechLang = "en-IN";
    private boolean waitingForMicPermission = false;

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
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(true);
            }
        }

        ViewGroup contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#0D2E14"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
                );
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });

            // Build WhatsApp-style Native Lock Overlay on top of the app
            setupNativeLockOverlay(contentView);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new AndroidBiometricBridge(), "AndroidBiometric");
            webView.addJavascriptInterface(new AndroidSpeechBridge(), "AndroidSpeech");
        }

        if (isNativeLockEnabled()) {
            isSessionUnlocked = false;
            showNativeLockScreenAndPrompt();
        } else {
            isSessionUnlocked = true;
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        lastBackgroundTimestamp = System.currentTimeMillis();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (isNativeLockEnabled()) {
            long elapsed = System.currentTimeMillis() - lastBackgroundTimestamp;
            if (!isSessionUnlocked || (lastBackgroundTimestamp > 0 && elapsed > BACKGROUND_RELOCK_MS)) {
                isSessionUnlocked = false;
                showNativeLockScreenAndPrompt();
            }
        }
    }

    private SharedPreferences getSecurityPrefs() {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private boolean isNativeLockEnabled() {
        return getSecurityPrefs().getBoolean(KEY_BIO_ENABLED, false);
    }

    private void setNativeLockEnabled(boolean enabled) {
        getSecurityPrefs().edit().putBoolean(KEY_BIO_ENABLED, enabled).apply();
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
    }

    private void setupNativeLockOverlay(ViewGroup root) {
        nativeLockOverlay = new FrameLayout(this);
        nativeLockOverlay.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        nativeLockOverlay.setBackgroundColor(Color.parseColor("#F3F5F1"));
        nativeLockOverlay.setClickable(true);
        nativeLockOverlay.setFocusable(true);
        nativeLockOverlay.setVisibility(View.GONE);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardParams.gravity = Gravity.CENTER;
        cardParams.setMargins(dp(28), dp(28), dp(28), dp(28));
        card.setLayoutParams(cardParams);
        card.setPadding(dp(24), dp(32), dp(24), dp(28));

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.WHITE);
        cardBg.setCornerRadius(dp(24));
        cardBg.setStroke(dp(1), Color.parseColor("#E2E8E0"));
        card.setBackground(cardBg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setElevation(dp(8));
        }

        // Lock Badge
        TextView badgeIcon = new TextView(this);
        badgeIcon.setText("🔒");
        badgeIcon.setTextSize(TypedValue.COMPLEX_UNIT_SP, 32);
        badgeIcon.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(64), dp(64));
        iconParams.bottomMargin = dp(16);
        badgeIcon.setLayoutParams(iconParams);
        GradientDrawable iconBg = new GradientDrawable();
        iconBg.setColor(Color.parseColor("#0D2E14"));
        iconBg.setCornerRadius(dp(18));
        badgeIcon.setBackground(iconBg);
        card.addView(badgeIcon);

        // Title
        TextView titleView = new TextView(this);
        titleView.setText("Funds Logger Locked");
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setTextColor(Color.parseColor("#0D2E14"));
        titleView.setGravity(Gravity.CENTER);
        card.addView(titleView);

        // Subtitle
        TextView subView = new TextView(this);
        subView.setText("Use your phone's fingerprint sensor, Face Unlock, or screen lock PIN to open Funds Logger.");
        subView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        subView.setTextColor(Color.parseColor("#64748B"));
        subView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subParams.topMargin = dp(8);
        subParams.bottomMargin = dp(24);
        subView.setLayoutParams(subParams);
        card.addView(subView);

        // Unlock Button
        Button unlockBtn = new Button(this);
        unlockBtn.setText("Unlock with Fingerprint / PIN");
        unlockBtn.setAllCaps(false);
        unlockBtn.setTextColor(Color.WHITE);
        unlockBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        unlockBtn.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.parseColor("#0D2E14"));
        btnBg.setCornerRadius(dp(14));
        unlockBtn.setBackground(btnBg);
        unlockBtn.setPadding(dp(20), dp(12), dp(20), dp(12));
        unlockBtn.setOnClickListener(v -> triggerSystemBiometricForAppUnlock());
        card.addView(unlockBtn);

        nativeLockOverlay.addView(card);
        root.addView(nativeLockOverlay);
    }

    private void showNativeLockScreenAndPrompt() {
        runOnUiThread(() -> {
            if (nativeLockOverlay != null) {
                nativeLockOverlay.setVisibility(View.VISIBLE);
                nativeLockOverlay.bringToFront();
            }
            triggerSystemBiometricForAppUnlock();
        });
    }

    private void triggerSystemBiometricForAppUnlock() {
        if (isPromptShowing) return;
        launchSystemBiometricPrompt(
            "Funds Logger Locked",
            "Touch the fingerprint sensor or enter phone PIN",
            (success, error) -> {
                if (success) {
                    isSessionUnlocked = true;
                    if (nativeLockOverlay != null) {
                        nativeLockOverlay.setVisibility(View.GONE);
                    }
                    sendBiometricResultToWeb(true, null);
                }
            }
        );
    }

    private interface BiometricCallback {
        void onResult(boolean success, String error);
    }

    private BiometricPrompt.PromptInfo buildSystemPromptInfo(String title, String subtitle) {
        String safeTitle = (title != null && !title.isEmpty()) ? title : "Funds Logger Biometric Lock";
        String safeSub = (subtitle != null && !subtitle.isEmpty()) ? subtitle : "Touch the fingerprint sensor or use PIN";

        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(safeTitle)
            .setSubtitle(safeSub)
            .setConfirmationRequired(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG |
                BiometricManager.Authenticators.BIOMETRIC_WEAK |
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            );
        } else {
            builder.setDeviceCredentialAllowed(true);
        }
        return builder.build();
    }

    private void launchSystemBiometricPrompt(String title, String subtitle, BiometricCallback callback) {
        runOnUiThread(() -> {
            try {
                isPromptShowing = true;
                Executor executor = ContextCompat.getMainExecutor(MainActivity.this);
                BiometricPrompt biometricPrompt = new BiometricPrompt(
                    MainActivity.this,
                    executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            isPromptShowing = false;
                            callback.onResult(false, errString.toString());
                        }

                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            isPromptShowing = false;
                            callback.onResult(true, null);
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            // Keep system prompt open so user can retry fingerprint
                        }
                    }
                );

                BiometricPrompt.PromptInfo promptInfo;
                try {
                    promptInfo = buildSystemPromptInfo(title, subtitle);
                } catch (Exception fallbackEx) {
                    promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title != null && !title.isEmpty() ? title : "Funds Logger Biometric Lock")
                        .setSubtitle(subtitle != null && !subtitle.isEmpty() ? subtitle : "Touch the fingerprint sensor")
                        .setNegativeButtonText("Cancel")
                        .build();
                }

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                isPromptShowing = false;
                callback.onResult(false, e.getMessage() != null ? e.getMessage() : "Biometric sensor unavailable on this phone");
            }
        });
    }

    private void sendBiometricResultToWeb(boolean success, String error) {
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

    public class AndroidBiometricBridge {

        @JavascriptInterface
        public boolean isAvailable() {
            try {
                BiometricManager bm = BiometricManager.from(MainActivity.this);
                int canAuth = bm.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG |
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
        public boolean isLockEnabled() {
            return isNativeLockEnabled();
        }

        @JavascriptInterface
        public void setLockEnabled(boolean enabled) {
            setNativeLockEnabled(enabled);
            if (enabled) {
                isSessionUnlocked = true;
            } else {
                runOnUiThread(() -> {
                    if (nativeLockOverlay != null) {
                        nativeLockOverlay.setVisibility(View.GONE);
                    }
                });
            }
        }

        @JavascriptInterface
        public void authenticate(final String title, final String subtitle) {
            launchSystemBiometricPrompt(title, subtitle, (success, error) -> {
                if (success) {
                    isSessionUnlocked = true;
                    setNativeLockEnabled(true);
                    if (nativeLockOverlay != null) {
                        nativeLockOverlay.setVisibility(View.GONE);
                    }
                }
                sendBiometricResultToWeb(success, error);
            });
        }
    }

    @Override
    public void onDestroy() {
        destroyNativeSpeechRecognizer();
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_RECORD_AUDIO_SPEECH && waitingForMicPermission) {
            waitingForMicPermission = false;
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startNativeSpeechInternal(pendingSpeechLang);
            } else {
                emitSpeechEventToWeb("error", "Microphone permission denied. Please allow mic permission in App Settings.", 0);
            }
        }
    }

    private void destroyNativeSpeechRecognizer() {
        runOnUiThread(() -> {
            if (nativeSpeechRecognizer != null) {
                try {
                    nativeSpeechRecognizer.cancel();
                    nativeSpeechRecognizer.destroy();
                } catch (Exception ignored) {}
                nativeSpeechRecognizer = null;
            }
        });
    }

    private void emitSpeechEventToWeb(String type, String text, int rmsLevel) {
        runOnUiThread(() -> {
            try {
                if (getBridge() == null || getBridge().getWebView() == null) return;
                JSONObject payload = new JSONObject();
                payload.put("type", type);
                payload.put("text", text != null ? text : "");
                payload.put("level", rmsLevel);
                String js = "window.dispatchEvent(new CustomEvent('nativeSpeechEvent', { detail: " + payload.toString() + " }));";
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private void startNativeSpeechInternal(final String lang) {
        runOnUiThread(() -> {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                    emitSpeechEventToWeb("error", "Speech recognition service unavailable on this device.", 0);
                    return;
                }

                if (nativeSpeechRecognizer != null) {
                    try {
                        nativeSpeechRecognizer.cancel();
                        nativeSpeechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    nativeSpeechRecognizer = null;
                }

                nativeSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                nativeSpeechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        emitSpeechEventToWeb("ready", "", 15);
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        emitSpeechEventToWeb("speechstart", "", 35);
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {
                        int normalized = Math.max(5, Math.min(100, (int) ((rmsdB + 2.0f) * 8.5f)));
                        emitSpeechEventToWeb("rms", "", normalized);
                    }

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        emitSpeechEventToWeb("speechend", "", 0);
                    }

                    @Override
                    public void onError(int error) {
                        // Error 6 = SPEECH_TIMEOUT, Error 7 = NO_MATCH, Error 8 = RECOGNIZER_BUSY -> quiet cycle end
                        if (error == SpeechRecognizer.ERROR_NO_MATCH
                            || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                            || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                            emitSpeechEventToWeb("end", "", 0);
                            return;
                        }
                        if (error == SpeechRecognizer.ERROR_CLIENT) {
                            return;
                        }
                        String msg = (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS)
                            ? "Microphone permission required."
                            : "Speech error (" + error + ")";
                        emitSpeechEventToWeb("error", msg, 0);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results != null
                            ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            : null;
                        String best = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        emitSpeechEventToWeb("final", best, 0);
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults != null
                            ? partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            : null;
                        String partial = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        if (!partial.isEmpty()) {
                            emitSpeechEventToWeb("partial", partial, 50);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                String effectiveLang = (lang != null && !lang.isEmpty()) ? lang : "en-IN";
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, effectiveLang);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, effectiveLang);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);

                nativeSpeechRecognizer.startListening(intent);
            } catch (Exception e) {
                emitSpeechEventToWeb("error", e.getMessage() != null ? e.getMessage() : "Could not start microphone", 0);
            }
        });
    }

    public class AndroidSpeechBridge {

        @JavascriptInterface
        public boolean isAvailable() {
            try {
                return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
            } catch (Exception e) {
                return true;
            }
        }

        @JavascriptInterface
        public void startListening(final String lang) {
            pendingSpeechLang = (lang != null && !lang.isEmpty()) ? lang : "en-IN";
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
                waitingForMicPermission = true;
                ActivityCompat.requestPermissions(
                    MainActivity.this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    REQ_RECORD_AUDIO_SPEECH
                );
                return;
            }
            startNativeSpeechInternal(pendingSpeechLang);
        }

        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(() -> {
                if (nativeSpeechRecognizer != null) {
                    try {
                        nativeSpeechRecognizer.stopListening();
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void cancel() {
            destroyNativeSpeechRecognizer();
        }
    }
}
