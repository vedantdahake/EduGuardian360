#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

// ===== WiFi & Backend =====
const char* ssid = "Airtel_sanj_8884";
const char* password = "Air@79743";

// Replace 192.168.1.7 with the IPv4 address of your computer
String serverName = "http://192.168.1.7:3000"; 
String mockGpsServer = "http://192.168.1.7:4000/gps";

// ===== RFID =====
#define SS_PIN 5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

// ===== OLED (SH1106) =====
Adafruit_SH1106G display(128, 64, &Wire);

// ===== BUTTON =====
#define SOS_BUTTON 32

bool emergencyActive = false;
unsigned long emergencyStart = 0;

// ===== GPS =====
unsigned long lastGpsFetch = 0;
const unsigned long gpsInterval = 5000; // Fetch GPS every 5 seconds

// ===== CENTER TEXT =====
void centerText(String text, int y, int size) {
  int16_t x1, y1;
  uint16_t w, h;

  display.setTextSize(size);
  display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);

  int x = (128 - w) / 2;
  if(x < 0) x = 0; // Prevent negative coordinates if text is too wide

  display.setCursor(x, y);
  display.println(text);
}

// ===== DISPLAY FUNCTIONS =====
void showConnecting() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  centerText("Connecting", 25, 2);
  display.display();
}

void showDefault() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  centerText("Scan ID", 25, 2); // Increased font size
  display.display();
}

void showGreeting(String name) {
  display.clearDisplay();
  centerText("HI !", 15, 2); // Increased font size
  // If the name is too long, we might want to reduce size, but let's stick to 2 to match request
  centerText(name, 40, 2); 
  display.display();
}

void showEmergency() {
  display.clearDisplay();
  centerText("EMERGENCY", 25, 2);
  display.display();
}

String getUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);

  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);

  pinMode(SOS_BUTTON, INPUT_PULLUP);

  Wire.begin(21, 4);

  if (!display.begin(0x3C, true)) {
    Serial.println("OLED not found");
    while (1);
  }

  showConnecting();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());

  showDefault();
}

// ===== LOOP =====
void loop() {
  
  // 🔴 BUTTON DEBUG
  if (digitalRead(SOS_BUTTON) == LOW) {
    Serial.println("BUTTON PRESSED");
  }

  // 📡 ARTIFICIAL GPS FETCH
  if (WiFi.status() == WL_CONNECTED && millis() - lastGpsFetch >= gpsInterval) {
    lastGpsFetch = millis();
    HTTPClient http;
    http.begin(mockGpsServer.c_str());
    int responseCode = http.GET();
    
    if (responseCode > 0) {
      String payload = http.getString();
      
      // Parse lat and lng (naive text extraction)
      int latIdx = payload.indexOf("\"lat\":");
      int lngIdx = payload.indexOf("\"lng\":");
      
      if (latIdx > 0 && lngIdx > 0) {
        int latEnd = payload.indexOf(",", latIdx);
        int lngEnd = payload.indexOf(",", lngIdx);
        if (lngEnd == -1) lngEnd = payload.indexOf("}", lngIdx);
        
        String latStr = payload.substring(latIdx + 6, latEnd);
        String lngStr = payload.substring(lngIdx + 6, lngEnd);
        
        // Formulate GET to update location
        String updateUrl = serverName + "/update-location?bus_id=bus_01&lat=" + latStr + "&lng=" + lngStr;
        Serial.println("Simulating GPS Move: " + updateUrl);
        
        HTTPClient updateHttp;
        updateHttp.begin(updateUrl.c_str());
        updateHttp.GET();
        updateHttp.end();
      }
    }
    http.end();
  }

  // 🔴 SOS LOGIC
  if (digitalRead(SOS_BUTTON) == LOW && !emergencyActive) {
    emergencyActive = true;
    emergencyStart = millis();
    showEmergency();
    
    // SEND SOS TO BACKEND
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      String sosPath = serverName + "/sos/bus_01";
      http.begin(sosPath.c_str());
      int responseCode = http.GET();
      Serial.print("SOS Sent. HTTP Code: "); 
      Serial.println(responseCode);
      http.end();
    }
  }

  if (emergencyActive) {
    if (millis() - emergencyStart >= 60000) {
      emergencyActive = false;
      showDefault();
    }
    delay(50);
    return;
  }

  // 📡 RFID
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String uid = getUID();
  Serial.println("CARD DETECTED: " + uid);

  String childName = "Unknown ID";

  // SEND SCAN TO BACKEND
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String scanPath = serverName + "/scan-entry/" + uid;
    Serial.println("Sending Request to: " + scanPath);
    
    http.begin(scanPath.c_str());
    int responseCode = http.GET();
    
    if (responseCode > 0) {
      String payload = http.getString();
      Serial.println("Server Response: " + payload);
      
      // Parse child name from JSON response (e.g. "child":"Aman Verma")
      int childIdx = payload.indexOf("\"child\":\"");
      if (childIdx > 0) {
        int startIdx = childIdx + 9;
        int endIdx = payload.indexOf("\"", startIdx);
        if (endIdx > startIdx) {
          childName = payload.substring(startIdx, endIdx);
        }
      } else if (payload.indexOf("\"message\":\"User not found\"") > 0) {
         childName = "Not Found";
      }
    } else {
      Serial.print("Error code: ");
      Serial.println(responseCode);
      childName = "Conn Error";
    }
    http.end();
  }

  // Display greeting
  showGreeting(childName);
  delay(3000);

  showDefault();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000);
}
