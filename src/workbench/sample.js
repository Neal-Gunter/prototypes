export const SAMPLE_FIRMWARE = `// 简化固件。由页面内的 JavaScript 解释器执行，不是 ESP32-S3。
Servo arm;

void setup() {
  arm.attach(4);
  Serial.println("解释器已启动");
  arm.write(90);
}

void loop() {
  delay(300);
  arm.write(28);
  delay(650);
  arm.write(152);
  delay(650);
}
`;
