package com.techisland.apidemo;

import android.Manifest;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import android.content.Context;

public class CameraActivity extends AppCompatActivity {

    private static final int PERMISSION_REQUEST_CODE = 102;

    private TextView statusText;
    private TextView outputText;
    private CameraManager cameraManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Camera Demo");
        actionButton.setText("Show Camera Info");

        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);

        StringBuilder info = new StringBuilder();
        info.append("=== CAMERA API DEMO ===\n\n");
        info.append("This demo shows camera information\n");
        info.append("and capabilities.\n\n");

        if (checkPermission()) {
            info.append("✓ Camera permission granted\n");
        } else {
            info.append("⚠ Camera permission required\n");
        }

        outputText.setText(info.toString());

        actionButton.setOnClickListener(v -> {
            if (checkPermission()) {
                showCameraInfo();
            } else {
                requestPermission();
            }
        });

        if (checkPermission()) {
            showCameraInfo();
        }
    }

    private boolean checkPermission() {
        return ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void requestPermission() {
        ActivityCompat.requestPermissions(
            this,
            new String[]{Manifest.permission.CAMERA},
            PERMISSION_REQUEST_CODE
        );
    }

    private void showCameraInfo() {
        if (!checkPermission()) {
            statusText.setText("Camera permission denied");
            return;
        }

        StringBuilder info = new StringBuilder();
        info.append("=== CAMERA INFORMATION ===\n\n");

        try {
            String[] cameraIds = cameraManager.getCameraIdList();
            info.append("Number of cameras: ").append(cameraIds.length).append("\n\n");

            for (String cameraId : cameraIds) {
                CameraCharacteristics characteristics = cameraManager.getCameraCharacteristics(cameraId);

                info.append("--- Camera ").append(cameraId).append(" ---\n\n");

                Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                if (facing != null) {
                    String facingStr = "Unknown";
                    if (facing == CameraCharacteristics.LENS_FACING_FRONT) {
                        facingStr = "Front";
                    } else if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                        facingStr = "Back";
                    } else if (facing == CameraCharacteristics.LENS_FACING_EXTERNAL) {
                        facingStr = "External";
                    }
                    info.append("Direction: ").append(facingStr).append("\n");
                }

                Integer level = characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL);
                if (level != null) {
                    String levelStr = "Unknown";
                    switch (level) {
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY:
                            levelStr = "Legacy";
                            break;
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED:
                            levelStr = "Limited";
                            break;
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL:
                            levelStr = "Full";
                            break;
                        case CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3:
                            levelStr = "Level 3";
                            break;
                    }
                    info.append("Hardware Level: ").append(levelStr).append("\n");
                }

                Boolean flashAvailable = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (flashAvailable != null) {
                    info.append("Flash: ").append(flashAvailable ? "Available" : "Not available").append("\n");
                }

                Float maxZoom = characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM);
                if (maxZoom != null) {
                    info.append(String.format("Max Digital Zoom: %.1fx\n", maxZoom));
                }

                int[] capabilities = characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                if (capabilities != null && capabilities.length > 0) {
                    info.append("Capabilities: ");
                    for (int cap : capabilities) {
                        switch (cap) {
                            case CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_BACKWARD_COMPATIBLE:
                                info.append("Basic ");
                                break;
                            case CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR:
                                info.append("Manual ");
                                break;
                            case CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_POST_PROCESSING:
                                info.append("PostProc ");
                                break;
                            case CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_RAW:
                                info.append("RAW ");
                                break;
                        }
                    }
                    info.append("\n");
                }

                info.append("\n");
            }

            outputText.setText(info.toString());
            statusText.setText("Camera info retrieved successfully");

        } catch (CameraAccessException e) {
            info.append("\n✗ Error accessing camera: ").append(e.getMessage()).append("\n");
            outputText.setText(info.toString());
            statusText.setText("Camera access error");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                showCameraInfo();
            } else {
                StringBuilder log = new StringBuilder(outputText.getText());
                log.append("\n✗ Camera permission denied\n");
                outputText.setText(log.toString());
                statusText.setText("Permission denied");
            }
        }
    }
}
