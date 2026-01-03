package com.techisland.apidemo;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static class Demo {
        String name;
        Class<?> activityClass;

        Demo(String name, Class<?> activityClass) {
            this.name = name;
            this.activityClass = activityClass;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        LinearLayout demoList = findViewById(R.id.demoList);

        // Define all demos
        Demo[] demos = new Demo[]{
            new Demo("📷 Camera", CameraActivity.class),
            new Demo("📍 Location/GPS", LocationActivity.class),
            new Demo("📱 Sensors", SensorActivity.class),
            new Demo("🔔 Notifications", NotificationActivity.class),
            new Demo("💾 Storage", StorageActivity.class),
            new Demo("📊 Device Info", DeviceInfoActivity.class),
            new Demo("📳 Vibration", VibrateActivity.class),
            new Demo("🌐 Network/HTTP", NetworkActivity.class)
        };

        // Create buttons for each demo
        for (Demo demo : demos) {
            Button button = new Button(this);
            button.setText(demo.name);
            button.setTextSize(18);
            button.setPadding(32, 32, 32, 32);

            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            params.setMargins(0, 0, 0, 16);
            button.setLayoutParams(params);

            button.setOnClickListener(v -> {
                Intent intent = new Intent(MainActivity.this, demo.activityClass);
                startActivity(intent);
            });

            demoList.addView(button);
        }
    }
}
