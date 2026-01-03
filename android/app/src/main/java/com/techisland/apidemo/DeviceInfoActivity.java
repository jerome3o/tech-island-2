package com.techisland.apidemo;

import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import android.util.DisplayMetrics;
import android.app.ActivityManager;
import android.content.Context;

public class DeviceInfoActivity extends AppCompatActivity {

    private TextView statusText;
    private TextView outputText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Device Information");
        actionButton.setText("Show Device Info");

        actionButton.setOnClickListener(v -> showDeviceInfo());

        // Show info on start
        showDeviceInfo();
    }

    private void showDeviceInfo() {
        StringBuilder info = new StringBuilder();

        info.append("=== DEVICE INFO ===\n\n");

        info.append("Manufacturer: ").append(Build.MANUFACTURER).append("\n");
        info.append("Brand: ").append(Build.BRAND).append("\n");
        info.append("Model: ").append(Build.MODEL).append("\n");
        info.append("Device: ").append(Build.DEVICE).append("\n");
        info.append("Product: ").append(Build.PRODUCT).append("\n\n");

        info.append("=== OS INFO ===\n\n");
        info.append("Android Version: ").append(Build.VERSION.RELEASE).append("\n");
        info.append("SDK Level: ").append(Build.VERSION.SDK_INT).append("\n");
        info.append("Build ID: ").append(Build.ID).append("\n");
        info.append("Build Type: ").append(Build.TYPE).append("\n\n");

        info.append("=== HARDWARE ===\n\n");
        info.append("Hardware: ").append(Build.HARDWARE).append("\n");
        info.append("Board: ").append(Build.BOARD).append("\n");
        info.append("Supported ABIs: ").append(String.join(", ", Build.SUPPORTED_ABIS)).append("\n\n");

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        info.append("=== DISPLAY ===\n\n");
        info.append("Width: ").append(metrics.widthPixels).append(" px\n");
        info.append("Height: ").append(metrics.heightPixels).append(" px\n");
        info.append("Density: ").append(metrics.density).append("\n");
        info.append("DPI: ").append(metrics.densityDpi).append("\n\n");

        ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo memoryInfo = new ActivityManager.MemoryInfo();
        activityManager.getMemoryInfo(memoryInfo);

        info.append("=== MEMORY ===\n\n");
        info.append("Total RAM: ").append(memoryInfo.totalMem / (1024 * 1024)).append(" MB\n");
        info.append("Available RAM: ").append(memoryInfo.availMem / (1024 * 1024)).append(" MB\n");
        info.append("Low Memory: ").append(memoryInfo.lowMemory ? "Yes" : "No").append("\n");

        outputText.setText(info.toString());
        statusText.setText("Device info retrieved successfully");
    }
}
