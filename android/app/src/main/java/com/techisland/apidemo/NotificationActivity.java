package com.techisland.apidemo;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class NotificationActivity extends AppCompatActivity {

    private static final String CHANNEL_ID = "demo_channel";
    private static final int NOTIFICATION_ID = 1;
    private static final int PERMISSION_REQUEST_CODE = 100;

    private TextView statusText;
    private TextView outputText;
    private int notificationCount = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_demo);

        statusText = findViewById(R.id.statusText);
        outputText = findViewById(R.id.outputText);
        Button actionButton = findViewById(R.id.actionButton);

        statusText.setText("Notification Demo");
        actionButton.setText("Send Notification");

        createNotificationChannel();

        StringBuilder info = new StringBuilder();
        info.append("=== NOTIFICATION DEMO ===\n\n");
        info.append("This demo shows how to create and display\n");
        info.append("notifications on Android.\n\n");
        info.append("Notifications will appear in your status bar.\n\n");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                info.append("⚠ Notification permission required\n");
                info.append("Please grant permission when prompted.\n");
            } else {
                info.append("✓ Notification permission granted\n");
            }
        } else {
            info.append("✓ No permission required (Android < 13)\n");
        }

        outputText.setText(info.toString());

        actionButton.setOnClickListener(v -> sendNotification());

        // Request permission if needed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                    PERMISSION_REQUEST_CODE
                );
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Demo Channel";
            String description = "Channel for demo notifications";
            int importance = NotificationManager.IMPORTANCE_DEFAULT;

            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void sendNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                statusText.setText("Notification permission denied");
                return;
            }
        }

        notificationCount++;

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Test Notification #" + notificationCount)
            .setContentText("This is a demo notification from the Android API Demo app")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        notificationManager.notify(NOTIFICATION_ID + notificationCount, builder.build());

        StringBuilder log = new StringBuilder(outputText.getText());
        log.append("\n✓ Notification #").append(notificationCount).append(" sent\n");
        outputText.setText(log.toString());

        statusText.setText("Notification sent successfully");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                StringBuilder log = new StringBuilder(outputText.getText());
                log.append("\n✓ Notification permission granted\n");
                outputText.setText(log.toString());
                statusText.setText("Permission granted");
            } else {
                StringBuilder log = new StringBuilder(outputText.getText());
                log.append("\n✗ Notification permission denied\n");
                outputText.setText(log.toString());
                statusText.setText("Permission denied");
            }
        }
    }
}
