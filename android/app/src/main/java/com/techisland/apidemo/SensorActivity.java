package com.techisland.apidemo;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.util.List;
import java.util.Locale;

public class SensorActivity extends AppCompatActivity implements SensorEventListener {

    private TextView statusText;
    private TextView outputText;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor gyroscope;
    private Sensor lightSensor;
    private boolean isMonitoring = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Sensor Demo");
        actionButton.setText("Start Monitoring");

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
        lightSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);

        showSensorInfo();

        actionButton.setOnClickListener(v -> {
            if (isMonitoring) {
                stopMonitoring();
                actionButton.setText("Start Monitoring");
            } else {
                startMonitoring();
                actionButton.setText("Stop Monitoring");
            }
        });
    }

    private void showSensorInfo() {
        StringBuilder info = new StringBuilder();
        info.append("=== AVAILABLE SENSORS ===\n\n");

        List<Sensor> sensors = sensorManager.getSensorList(Sensor.TYPE_ALL);
        info.append("Total sensors: ").append(sensors.size()).append("\n\n");

        // List key sensors
        addSensorInfo(info, "Accelerometer", accelerometer);
        addSensorInfo(info, "Gyroscope", gyroscope);
        addSensorInfo(info, "Light Sensor", lightSensor);

        info.append("\n=== OTHER SENSORS ===\n\n");

        Sensor magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        addSensorInfo(info, "Magnetometer", magnetometer);

        Sensor pressure = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE);
        addSensorInfo(info, "Pressure", pressure);

        Sensor proximity = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY);
        addSensorInfo(info, "Proximity", proximity);

        Sensor temperature = sensorManager.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE);
        addSensorInfo(info, "Temperature", temperature);

        outputText.setText(info.toString());
    }

    private void addSensorInfo(StringBuilder info, String name, Sensor sensor) {
        if (sensor != null) {
            info.append("✓ ").append(name).append("\n");
            info.append("  Vendor: ").append(sensor.getVendor()).append("\n");
            info.append("  Version: ").append(sensor.getVersion()).append("\n");
            info.append("  Power: ").append(sensor.getPower()).append(" mA\n\n");
        } else {
            info.append("✗ ").append(name).append(": Not available\n\n");
        }
    }

    private void startMonitoring() {
        if (accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_NORMAL);
        }
        if (gyroscope != null) {
            sensorManager.registerListener(this, gyroscope, SensorManager.SENSOR_DELAY_NORMAL);
        }
        if (lightSensor != null) {
            sensorManager.registerListener(this, lightSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }

        isMonitoring = true;
        statusText.setText("Monitoring sensors...");
    }

    private void stopMonitoring() {
        sensorManager.unregisterListener(this);
        isMonitoring = false;
        statusText.setText("Monitoring stopped");
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!isMonitoring) return;

        StringBuilder data = new StringBuilder();
        data.append("=== LIVE SENSOR DATA ===\n\n");

        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            data.append("Accelerometer (m/s²):\n");
            data.append(String.format(Locale.US, "  X: %.2f\n", event.values[0]));
            data.append(String.format(Locale.US, "  Y: %.2f\n", event.values[1]));
            data.append(String.format(Locale.US, "  Z: %.2f\n\n", event.values[2]));
        } else if (event.sensor.getType() == Sensor.TYPE_GYROSCOPE) {
            data.append("Gyroscope (rad/s):\n");
            data.append(String.format(Locale.US, "  X: %.2f\n", event.values[0]));
            data.append(String.format(Locale.US, "  Y: %.2f\n", event.values[1]));
            data.append(String.format(Locale.US, "  Z: %.2f\n\n", event.values[2]));
        } else if (event.sensor.getType() == Sensor.TYPE_LIGHT) {
            data.append("Light Sensor (lux):\n");
            data.append(String.format(Locale.US, "  Illuminance: %.2f\n\n", event.values[0]));
        }

        // Append to existing output
        String currentText = outputText.getText().toString();
        if (currentText.contains("=== LIVE SENSOR DATA ===")) {
            // Replace the live data section
            int index = currentText.indexOf("=== LIVE SENSOR DATA ===");
            currentText = currentText.substring(0, index);
        }

        outputText.setText(currentText + data.toString());
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed for this demo
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (isMonitoring) {
            stopMonitoring();
        }
    }
}
