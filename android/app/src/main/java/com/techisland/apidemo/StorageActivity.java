package com.techisland.apidemo;

import android.os.Bundle;
import android.os.Environment;
import android.os.StatFs;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.BufferedReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StorageActivity extends AppCompatActivity {

    private TextView statusText;
    private TextView outputText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Storage Demo");
        actionButton.setText("Test File Operations");

        showStorageInfo();

        actionButton.setOnClickListener(v -> testFileOperations());
    }

    private void showStorageInfo() {
        StringBuilder info = new StringBuilder();

        info.append("=== STORAGE INFO ===\n\n");

        File internalDir = getFilesDir();
        info.append("Internal Storage Path:\n").append(internalDir.getAbsolutePath()).append("\n\n");

        File cacheDir = getCacheDir();
        info.append("Cache Directory:\n").append(cacheDir.getAbsolutePath()).append("\n\n");

        StatFs internalStat = new StatFs(internalDir.getAbsolutePath());
        long internalAvailable = internalStat.getAvailableBytes() / (1024 * 1024);
        long internalTotal = internalStat.getTotalBytes() / (1024 * 1024);

        info.append("Internal Storage:\n");
        info.append("  Available: ").append(internalAvailable).append(" MB\n");
        info.append("  Total: ").append(internalTotal).append(" MB\n\n");

        if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
            File externalDir = getExternalFilesDir(null);
            if (externalDir != null) {
                info.append("External Storage Path:\n").append(externalDir.getAbsolutePath()).append("\n\n");

                StatFs externalStat = new StatFs(externalDir.getAbsolutePath());
                long externalAvailable = externalStat.getAvailableBytes() / (1024 * 1024);
                long externalTotal = externalStat.getTotalBytes() / (1024 * 1024);

                info.append("External Storage:\n");
                info.append("  Available: ").append(externalAvailable).append(" MB\n");
                info.append("  Total: ").append(externalTotal).append(" MB\n\n");
            }
        } else {
            info.append("External storage not available\n\n");
        }

        outputText.setText(info.toString());
    }

    private void testFileOperations() {
        StringBuilder log = new StringBuilder(outputText.getText());
        log.append("\n=== FILE OPERATIONS TEST ===\n\n");

        try {
            // Write to file
            String filename = "test_file.txt";
            File file = new File(getFilesDir(), filename);

            String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date());
            String content = "Test data written at: " + timestamp + "\n";

            FileWriter writer = new FileWriter(file, true);
            writer.write(content);
            writer.close();

            log.append("✓ File written successfully\n");
            log.append("  File: ").append(file.getAbsolutePath()).append("\n\n");

            // Read from file
            BufferedReader reader = new BufferedReader(new FileReader(file));
            StringBuilder fileContent = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                fileContent.append(line).append("\n");
            }
            reader.close();

            log.append("✓ File read successfully\n");
            log.append("  File size: ").append(file.length()).append(" bytes\n\n");

            log.append("File contents:\n");
            log.append(fileContent.toString());

            statusText.setText("File operations completed successfully");

        } catch (Exception e) {
            log.append("✗ Error: ").append(e.getMessage()).append("\n");
            statusText.setText("Error during file operations");
        }

        outputText.setText(log.toString());
    }
}
