package com.techisland.apidemo;

import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import android.content.Context;

public class VibrateActivity extends AppCompatActivity {

    private TextView statusText;
    private TextView outputText;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        statusText.setText("Vibration Demo");
        actionButton.setText("Test Vibration Patterns");

        StringBuilder info = new StringBuilder();
        info.append("Vibrator capabilities:\n\n");
        info.append("Has Vibrator: ").append(vibrator.hasVibrator()).append("\n");
        info.append("Has Amplitude Control: ").append(vibrator.hasAmplitudeControl()).append("\n\n");

        info.append("Click the button to test different vibration patterns!");

        outputText.setText(info.toString());

        actionButton.setOnClickListener(v -> testVibrationPatterns());
    }

    private void testVibrationPatterns() {
        if (!vibrator.hasVibrator()) {
            statusText.setText("No vibrator available");
            return;
        }

        // Pattern: wait 0ms, vibrate 200ms, wait 200ms, vibrate 500ms
        long[] pattern = {0, 200, 200, 500, 200, 200, 200, 500};

        VibrationEffect effect = VibrationEffect.createWaveform(pattern, -1);
        vibrator.vibrate(effect);

        statusText.setText("Vibrating with pattern...");

        StringBuilder log = new StringBuilder(outputText.getText());
        log.append("\n\n=== Vibration Test ===\n");
        log.append("Pattern executed:\n");
        log.append("- Short buzz (200ms)\n");
        log.append("- Long buzz (500ms)\n");
        log.append("- Short buzz (200ms)\n");
        log.append("- Long buzz (500ms)\n");

        outputText.setText(log.toString());
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (vibrator != null) {
            vibrator.cancel();
        }
    }
}
