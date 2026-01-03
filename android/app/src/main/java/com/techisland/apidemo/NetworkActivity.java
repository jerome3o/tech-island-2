package com.techisland.apidemo;

import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiManager;
import android.content.Context;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class NetworkActivity extends AppCompatActivity {

    private TextView statusText;
    private TextView outputText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Network Demo");
        actionButton.setText("Make HTTP Request");

        showNetworkInfo();

        actionButton.setOnClickListener(v -> makeHttpRequest());
    }

    private void showNetworkInfo() {
        StringBuilder info = new StringBuilder();

        info.append("=== NETWORK INFO ===\n\n");

        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();

        if (activeNetwork != null && activeNetwork.isConnected()) {
            info.append("Connection Status: Connected\n");
            info.append("Connection Type: ").append(activeNetwork.getTypeName()).append("\n");
            info.append("Subtype: ").append(activeNetwork.getSubtypeName()).append("\n");
            info.append("Fast: ").append(activeNetwork.isFailover() ? "Yes" : "No").append("\n\n");
        } else {
            info.append("Connection Status: Not connected\n\n");
        }

        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
            info.append("WiFi Enabled: ").append(wifiManager.isWifiEnabled() ? "Yes" : "No").append("\n");

            if (wifiManager.isWifiEnabled() && wifiManager.getConnectionInfo() != null) {
                String ssid = wifiManager.getConnectionInfo().getSSID();
                int rssi = wifiManager.getConnectionInfo().getRssi();
                info.append("Connected SSID: ").append(ssid).append("\n");
                info.append("Signal Strength: ").append(rssi).append(" dBm\n");
            }
        }

        outputText.setText(info.toString());
    }

    private void makeHttpRequest() {
        statusText.setText("Making HTTP request...");

        new Thread(() -> {
            try {
                URL url = new URL("https://httpbin.org/get");
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);

                int responseCode = connection.getResponseCode();

                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream())
                );

                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line).append("\n");
                }
                reader.close();

                String result = response.toString();

                runOnUiThread(() -> {
                    StringBuilder log = new StringBuilder(outputText.getText());
                    log.append("\n\n=== HTTP REQUEST ===\n\n");
                    log.append("URL: https://httpbin.org/get\n");
                    log.append("Response Code: ").append(responseCode).append("\n\n");
                    log.append("Response Body:\n");
                    log.append(result.substring(0, Math.min(500, result.length())));
                    if (result.length() > 500) {
                        log.append("\n... (truncated)");
                    }

                    outputText.setText(log.toString());
                    statusText.setText("HTTP request completed successfully");
                });

            } catch (Exception e) {
                runOnUiThread(() -> {
                    StringBuilder log = new StringBuilder(outputText.getText());
                    log.append("\n\n=== HTTP REQUEST ===\n\n");
                    log.append("✗ Error: ").append(e.getMessage()).append("\n");

                    outputText.setText(log.toString());
                    statusText.setText("HTTP request failed");
                });
            }
        }).start();
    }
}
