// 桩编译（STUB COMPILE）入口：只验证 octopus_mcp.cpp 能对着上游 mcp_server.h（xiaozhi-esp32 @ addb1ed）编译。
#include <Wire.h>
#include "octopus_body.h"
void RegisterOctopusTools(octo::OctopusBody& body);
octo::OctopusBody body;
void setup() { RegisterOctopusTools(body); }
void loop() {}
