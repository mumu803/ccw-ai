const int ledPin = 13; // 內建 LED

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (Serial.available()) {
    char command = Serial.read();
    if (command == 'B') {
      digitalWrite(ledPin, HIGH);
      delay(300); // 閃爍時間
      digitalWrite(ledPin, LOW);
    }
  }
}
