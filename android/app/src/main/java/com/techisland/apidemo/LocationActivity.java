package com.techisland.apidemo;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import java.util.Locale;

public class LocationActivity extends AppCompatActivity implements LocationListener {

    private static final int PERMISSION_REQUEST_CODE = 101;

    private TextView statusText;
    private TextView outputText;
    private LocationManager locationManager;
    private boolean isTracking = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Location/GPS Demo");
        actionButton.setText("Get Location");

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        showLocationInfo();

        actionButton.setOnClickListener(v -> {
            if (checkPermissions()) {
                getLocation();
            } else {
                requestPermissions();
            }
        });
    }

    private void showLocationInfo() {
        StringBuilder info = new StringBuilder();
        info.append("=== LOCATION PROVIDERS ===\n\n");

        boolean gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        boolean networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

        info.append("GPS Provider: ").append(gpsEnabled ? "Enabled ✓" : "Disabled ✗").append("\n");
        info.append("Network Provider: ").append(networkEnabled ? "Enabled ✓" : "Disabled ✗").append("\n\n");

        if (checkPermissions()) {
            info.append("✓ Location permission granted\n");
        } else {
            info.append("⚠ Location permission required\n");
            info.append("Click button to request permission\n");
        }

        outputText.setText(info.toString());
    }

    private boolean checkPermissions() {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void requestPermissions() {
        ActivityCompat.requestPermissions(
            this,
            new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            PERMISSION_REQUEST_CODE
        );
    }

    private void getLocation() {
        if (!checkPermissions()) {
            statusText.setText("Location permission denied");
            return;
        }

        statusText.setText("Getting location...");

        try {
            // Get last known location
            Location lastLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            if (lastLocation == null) {
                lastLocation = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }

            if (lastLocation != null) {
                displayLocation(lastLocation, "Last Known");
            } else {
                StringBuilder log = new StringBuilder(outputText.getText());
                log.append("\n\nNo cached location available.\n");
                log.append("Requesting location updates...\n");
                outputText.setText(log.toString());

                // Request location updates
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    0,
                    0,
                    this
                );
                isTracking = true;
            }
        } catch (SecurityException e) {
            statusText.setText("Location access error");
        }
    }

    private void displayLocation(Location location, String source) {
        StringBuilder log = new StringBuilder(outputText.getText());
        log.append("\n\n=== LOCATION (").append(source).append(") ===\n\n");

        log.append(String.format(Locale.US, "Latitude: %.6f\n", location.getLatitude()));
        log.append(String.format(Locale.US, "Longitude: %.6f\n", location.getLongitude()));

        if (location.hasAltitude()) {
            log.append(String.format(Locale.US, "Altitude: %.1f m\n", location.getAltitude()));
        }

        if (location.hasAccuracy()) {
            log.append(String.format(Locale.US, "Accuracy: %.1f m\n", location.getAccuracy()));
        }

        if (location.hasSpeed()) {
            log.append(String.format(Locale.US, "Speed: %.1f m/s\n", location.getSpeed()));
        }

        if (location.hasBearing()) {
            log.append(String.format(Locale.US, "Bearing: %.1f°\n", location.getBearing()));
        }

        log.append("Provider: ").append(location.getProvider()).append("\n");

        outputText.setText(log.toString());
        statusText.setText("Location retrieved successfully");
    }

    @Override
    public void onLocationChanged(Location location) {
        displayLocation(location, "Current");

        if (isTracking) {
            locationManager.removeUpdates(this);
            isTracking = false;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                showLocationInfo();
                getLocation();
            } else {
                StringBuilder log = new StringBuilder(outputText.getText());
                log.append("\n✗ Location permission denied\n");
                outputText.setText(log.toString());
                statusText.setText("Permission denied");
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (isTracking) {
            locationManager.removeUpdates(this);
            isTracking = false;
        }
    }
}
