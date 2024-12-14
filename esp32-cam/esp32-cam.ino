#include "esp_camera.h"
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include "esp_timer.h"
#include "img_converters.h"
#include "fb_gfx.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "driver/gpio.h"
#include <HardwareSerial.h>

// Pin Definitions
#define LED_PIN 12
#define MQ2_PIN 13
#define FL_PIN 14
#define RXD 16
#define TXD 15

// Camera pins for AI Thinker Camera board
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

// Network Configuration
const char *ssid = "Dong Tay 4G";
const char *password = "88888888";
const char *websockets_server_host = "192.168.1.218";
const uint16_t sensor_ws_port = 3001;
const uint16_t camera_ws_port = 3002;

// Timing Constants
const unsigned long IMAGE_SEND_INTERVAL = 100;   // 10 FPS
const unsigned long SENSOR_SEND_INTERVAL = 1000; // 1 second
const unsigned long RECONNECT_DELAY = 2000;      // 2 seconds
const int MAX_RECONNECT_ATTEMPTS = 5;

// Global Variables
using namespace websockets;
WebsocketsClient sensorClient;
WebsocketsClient cameraClient;
bool isCameraEnabled = false;
unsigned long lastImageSend = 0;
unsigned long lastSensorSend = 0;
int reconnectAttempts = 0;

esp_err_t init_camera()
{
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 15;
  config.fb_count = 2;

  return esp_camera_init(&config);
}

void onSensorMessageCallback(WebsocketsMessage message)
{
  String msg = message.data();
  Serial.println(String("Sensor socket received: ") + msg.c_str());

  if (msg == "get_sensor_data")
  {
    sendSensorData();
  }
}

void onCameraMessageCallback(WebsocketsMessage message)
{
  String msg = message.data();
  Serial.println(String("Camera socket received: ") + msg.c_str());


  if (msg == "enable_camera")
  {
    isCameraEnabled = true;
    Serial.println("Camera streaming enabled");
  }
  else if (msg == "disable_camera")
  {
    isCameraEnabled = false;
    Serial.println("Camera streaming disabled");
  }
}

esp_err_t init_websockets()
{
  sensorClient.onMessage(onSensorMessageCallback);
  bool sensorConnected = sensorClient.connect(websockets_server_host, sensor_ws_port, "/");
  if (sensorConnected)
  {
    Serial.println("Connected to sensor socket");
    sensorClient.send("ESP32_SENSOR");
  }
  else
  {
    Serial.println("Failed to connect to sensor socket");
    return ESP_FAIL;
  }

  cameraClient.onMessage(onCameraMessageCallback);
  bool cameraConnected = cameraClient.connect(websockets_server_host, camera_ws_port, "/");
  if (cameraConnected)
  {
    Serial.println("Connected to camera socket");
    cameraClient.send("ESP32_CAMERA");
  }
  else
  {
    Serial.println("Failed to connect to camera socket");
    return ESP_FAIL;
  }

  return ESP_OK;
}

void sendSensorData()
{
  bool gasDetected = digitalRead(MQ2_PIN) == LOW;
  bool flameDetected = digitalRead(FL_PIN) == LOW;

  // Update LED state based on sensor readings
  digitalWrite(LED_PIN, (gasDetected || flameDetected) ? HIGH : LOW);

  // Only send data if we have a valid connection
  if (sensorClient.available())
  {
    String data = "{\"gas\":" + String(gasDetected ? "true" : "false") +
                  ",\"flame\":" + String(flameDetected ? "true" : "false") + "}";
    sensorClient.send(data);
    Serial.println("Sent sensor data: " + data);
  }
}

bool reconnectWebSocket()
{
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS)
  {
    Serial.println("Attempting to reconnect WebSockets...");
    if (init_websockets() == ESP_OK)
    {
      reconnectAttempts = 0;
      return true;
    }
    reconnectAttempts++;
    delay(RECONNECT_DELAY);
  }
  else
  {
    Serial.println("Max reconnection attempts reached. Restarting...");
    ESP.restart();
  }
  return false;
}

void setup()
{
  Serial.begin(115200);

  // Initialize GPIO pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(FL_PIN, INPUT);

  // Initialize camera
  if (init_camera() != ESP_OK)
  {
    Serial.println("Camera initialization failed");
    return;
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");

  if (init_websockets() != ESP_OK)
  {
    Serial.println("WebSockets initialization failed");
    return;
  }
}

void loop()
{
  // Check WebSocket connection
  if (!sensorClient.available())
  {
    if (!reconnectWebSocket())
    {
      return;
    }
  }

  // Handle WebSocket messages
  sensorClient.poll();
  cameraClient.poll();

  // Send sensor data at specified interval
  if (millis() - lastSensorSend >= SENSOR_SEND_INTERVAL)
  {
    sendSensorData();
    lastSensorSend = millis();
  }

  // Handle camera streaming if enabled
  if (isCameraEnabled && (millis() - lastImageSend >= IMAGE_SEND_INTERVAL))
  {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb)
    {
      if (cameraClient.available())
      {
        cameraClient.sendBinary((const char *)fb->buf, fb->len);
        Serial.printf("Image sent: %d bytes\n", fb->len);
      }
      esp_camera_fb_return(fb);
      lastImageSend = millis();
    }
  }
}