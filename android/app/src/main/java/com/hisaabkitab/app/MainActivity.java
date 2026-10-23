package com.hisaabkitab.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

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
    }
}
