### **Arduino pins-**



5V- Red of servo motor

5V- VCC of USS

GND- Brown of servo motor

GND- GND of USS

DIGITAL PIN 8- TRIG OF USS

9- ECHO OF USS

10- YELLOW OF SERVO MOTOR



### **Arduino code-**



\#include <Servo.h>



const int trigPin = 8;

const int echoPin = 9;



long duration;

int distance;



Servo myServo;



void setup() {

&#x20; pinMode(trigPin, OUTPUT);

&#x20; pinMode(echoPin, INPUT);

&#x20; Serial.begin(9600);

&#x20; myServo.attach(10);

}



void loop() {



&#x20; for (int i = 15; i <= 165; i += 2) {

&#x20;   myServo.write(i);

&#x20;   delay(40);



&#x20;   distance = calculateDistance();



&#x20;   Serial.print(i);

&#x20;   Serial.print(",");

&#x20;   Serial.print(distance);

&#x20;   Serial.print(".");

&#x20;   Serial.println();

&#x20; }



&#x20; for (int i = 165; i >= 15; i -= 2) {

&#x20;   myServo.write(i);

&#x20;   delay(40);



&#x20;   distance = calculateDistance();



&#x20;   Serial.print(i);

&#x20;   Serial.print(",");

&#x20;   Serial.print(distance);

&#x20;   Serial.print(".");

&#x20;   Serial.println();

&#x20; }

}



int calculateDistance() {

&#x20; digitalWrite(trigPin, LOW);

&#x20; delayMicroseconds(2);



&#x20; digitalWrite(trigPin, HIGH);

&#x20; delayMicroseconds(10);

&#x20; digitalWrite(trigPin, LOW);



&#x20; duration = pulseIn(echoPin, HIGH, 30000);



&#x20; int d = duration \* 0.034 / 2;



&#x20; if (d == 0 || d > 400) {

&#x20;   d = 400;

&#x20; }



&#x20; return d;

}





### &#x20;**Processing code**



**import processing.serial.\*;**



**Serial myPort;**

**String data = "";**

**float angle = 0;**

**float distance = 0;**



**int maxRange = 400;   // 🔥 SAME UNIT FOR EVERYTHING**



**void setup() {**

&#x20; **size(900, 600);**

&#x20; **printArray(Serial.list());**

&#x20; **myPort = new Serial(this, Serial.list()\[7], 9600); // adjust if needed**

&#x20; **myPort.bufferUntil('.');**

**}**



**void draw() {**

&#x20; **fill(0, 20);**

&#x20; **noStroke();**

&#x20; **rect(0, 0, width, height);**



&#x20; **drawRadar();**

&#x20; **drawLine();**

&#x20; **drawObject();**

&#x20; **drawText();**

**}**



**void serialEvent(Serial myPort) {**

&#x20; **data = myPort.readStringUntil('.');**

&#x20;

&#x20; **if (data != null) {**

&#x20;   **data = trim(data);**



&#x20;   **int commaIndex = data.indexOf(',');**



&#x20;   **if (commaIndex != -1) {**

&#x20;     **angle = float(data.substring(0, commaIndex));**

&#x20;     **distance = float(data.substring(commaIndex + 1));**

&#x20;

&#x20;     **distance = constrain(distance, 0, maxRange);**

&#x20;   **}**

&#x20; **}**

**}**



**// Radar grid**

**void drawRadar() {**

&#x20; **stroke(0, 255, 0);**

&#x20; **noFill();**



&#x20; **int radius = 250;**



&#x20; **for (int i = 1; i <= 4; i++) {**

&#x20;   **ellipse(width/2, height, i \* (radius/2), i \* (radius/2));**

&#x20; **}**



&#x20; **for (int i = 0; i <= 180; i += 30) {**

&#x20;   **float x = width/2 + cos(radians(i)) \* radius;**

&#x20;   **float y = height - sin(radians(i)) \* radius;**

&#x20;   **line(width/2, height, x, y);**

&#x20; **}**

**}**



**// Rotating beam**

**void drawLine() {**

&#x20; **stroke(0, 255, 0);**

&#x20; **strokeWeight(3);**



&#x20; **float radius = 250;**



&#x20; **float x = width/2 + cos(radians(angle)) \* radius;**

&#x20; **float y = height - sin(radians(angle)) \* radius;**



&#x20; **line(width/2, height, x, y);**

**}**



**// Object detection**

**void drawObject() {**

&#x20; **if (distance < maxRange) {**

&#x20;   **stroke(255, 0, 0);**

&#x20;   **strokeWeight(4);**



&#x20;   **float radius = 250;**



&#x20;   **float d = map(distance, 0, maxRange, 0, radius);**



&#x20;   **float x = width/2 + cos(radians(angle)) \* d;**

&#x20;   **float y = height - sin(radians(angle)) \* d;**



&#x20;   **line(width/2, height, x, y);**

&#x20; **}**

**}**



**// Text (MATCHED UNIT = cm)**

**void drawText() {**

&#x20; **fill(0, 255, 0);**

&#x20; **textSize(16);**



&#x20; **text("Angle: " + int(angle) + "°", 20, 30);**



&#x20; **if (distance >= maxRange) {**

&#x20;   **text("Distance: Out of Range (>400 cm)", 20, 50);**

&#x20; **} else {**

&#x20;   **text("Distance: " + int(distance) + " cm", 20, 50);**

&#x20; **}**



&#x20; **// Distance labels (same unit as radar)**

&#x20; **text("100cm", width/2 + 60, height - 60);**

&#x20; **text("200cm", width/2 + 120, height - 120);**

&#x20; **text("300cm", width/2 + 180, height - 180);**

&#x20; **text("400cm", width/2 + 240, height - 240);**

**}**

