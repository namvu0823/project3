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



#define LED_PIN 12
#define MQ2_PIN 13
#define FL_PIN 14
#define RXD 16
#define TXD 15


// configuration for AI Thinker Camera board
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

const char* ssid     = "OPPO A74"; // CHANGE HERE
const char* password = "23082003n"; // CHANGE HERE

const char* websockets_server_host = "192.168.36.227"; //CHANGE HERE
const uint16_t websockets_server_port = 3001; // OPTIONAL CHANGE

using namespace websockets;
WebsocketsClient client;

bool isCameraEnabled = false;
String lastCommand = "";

//HardwareSerial SIM(1);
//String number1 = "0373672833";
/*
int dem=0;
int gui1 = 0;
int gui2 = 0;
int gui3 = 0;
*/

esp_err_t init_camera() {
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

    config.frame_size = FRAMESIZE_VGA; // Adjust resolution as needed
    config.jpeg_quality = 15; // Image quality
    config.fb_count = 2;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return err;
    }
    Serial.println("Camera initialized successfully");
    return ESP_OK;
}

void onMessageCallback(WebsocketsMessage message) {
    String msg = message.data();
    Serial.printf("Received message: %s\n", msg.c_str());

    // Kiểm tra nếu là JSON
    if (msg.startsWith("{") && msg.endsWith("}")) {
        Serial.println("Received sensor data");
    } 
    else if (msg == "camera_enable") {
        isCameraEnabled = true;
        lastCommand = msg;
        Serial.println("Camera streaming enabled");
    } 
    else if (msg == "camera_disable") {
        isCameraEnabled = false;
        lastCommand = msg;
        Serial.println("Camera streaming disabled");
    } 
    else if (msg.startsWith("{") && msg.endsWith("}")) {
        Serial.println("Received sensor data");
    } else {
        Serial.println("Unknown command");
    }
}

esp_err_t init_wifi() {
    WiFi.begin(ssid, password);
    Serial.println("Connecting to WiFi...");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    client.onMessage(onMessageCallback);
    bool connected = client.connect(websockets_server_host, websockets_server_port, "/");
    if (!connected) {
        Serial.println("WebSocket connection failed");
        return ESP_FAIL;
    }
    Serial.println("WebSocket connected");
    client.send("ESP32");
    return ESP_OK;
}

/*
void message1() {
  SIM.println("AT+CMGF=1");
  delay(1000);
  SIM.println("AT+CMGS=\"" + number1 + "\"\r");
  delay(1000);
  String SMS = "PHAT HIEN CO CHAY";
  SIM.println(SMS);
  delay(100);
  SIM.println((char)26);
  delay(1000);
}
void message2() {
  SIM.println("AT+CMGF=1");
  delay(1000);
  SIM.println("AT+CMGS=\"" + number1 + "\"\r");
  delay(1000);
  String SMS = "PHAT HIEN CO KHOI";
  SIM.println(SMS);
  delay(100);
  SIM.println((char)26);
  delay(1000);
}
void message3() {
  SIM.println("AT+CMGF=1");
  delay(1000);
  SIM.println("AT+CMGS=\"" + number1 + "\"\r");
  delay(1000);
  String SMS = "PHAT HIEN CO CHAY VA KHOI";
  SIM.println(SMS);
  delay(100);
  SIM.println((char)26);
  delay(1000);
}

*/

void sendData(){
  bool Gas=digitalRead(MQ2_PIN)==LOW;
  bool Flame=digitalRead(FL_PIN)==LOW;

  String Data = "{\"gas\":" +  String(Gas ? "true" : "false")+ ",\"flame\":" + String(Flame ? "true" : "false") + "}";
  Serial.println("Sending JSON data: " + Data);
  client.send(Data);

   if (Gas || Flame) {
        digitalWrite(LED_PIN, HIGH); 
    } else {
        digitalWrite(LED_PIN, LOW);
    }
}

 /*
  if (!Gas && Flame) {
    Serial.println("PHAT HIEN CHAY");
    dem = 1;
    if (gui1 == 0) {
      message1();
      digitalWrite(LED_PIN, HIGH); 
      gui1 = 1;
    }
  }

  if (Gas && !Flame) {
    Serial.println("PHAT HIEN KHOI");
    
    dem = 1;
    if (gui2 == 0) {
      message2();
      digitalWrite(LED_PIN, HIGH); 
      gui2 = 1;
    }
  }
  if (Gas && Flame) {
    Serial.println("CO CHAY VA KHOI");
    digitalWrite(LED_PIN, HIGH);
    if (gui3 == 0) {
      message3();
      gui3 = 1;
    }
  }

  if(!Gas && !Flame && dem == 1) {
    dem = 0;
    gui1 = 0;
    gui2 = 0;
    gui3 = 0;
    Serial.println("HT BINH THUONG");
    digitalWrite(LED_PIN, LOW);
  }

}

*/
void setup() {

    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector

    Serial.begin(115200);
    Serial.println("Booting...");
    //SIM.begin(9600, SERIAL_8N1, RXD, TXD);


    pinMode(LED_PIN,OUTPUT);
    pinMode(MQ2_PIN,INPUT);
    pinMode(FL_PIN,INPUT);

    if (init_camera() != ESP_OK) {
        Serial.println("Camera initialization failed. Restarting...");
    }

    if (init_wifi() != ESP_OK) {
        Serial.println("WiFi initialization failed. Restarting...");
    }
}

void loop() {
  if (client.available()) {
    client.poll(); // giữ kết nối socket

    if(!isCameraEnabled){
      static unsigned long  lastSensorSend=0;
      if(millis()-lastSensorSend>1000){
        sendData();
        lastSensorSend=millis();
      }
    }
    else {
      camera_fb_t *fb = esp_camera_fb_get();
      if (fb) {
        Serial.printf("Image captured: %d bytes, Format: %d\n",fb->len, fb->format);
        client.sendBinary((const char*)fb->buf, fb->len);
        Serial.printf("Image captured and sent (%d bytes)\n", fb->len);
        esp_camera_fb_return(fb); // Giải phóng bộ nhớ frame buffer
      } 
      else {
        Serial.println("Failed to capture image");
      }
    }
  } 
  else {
    Serial.println("WebSocket disconnected, reconnecting...");
    bool connected = client.connect(websockets_server_host, websockets_server_port, "/");
    if (connected) {
      Serial.println("Reconnected successfully");
    } 
    else {
      Serial.println("Reconnection failed");
      delay(2000); // Chờ trước khi thử lại
    }
  }
}