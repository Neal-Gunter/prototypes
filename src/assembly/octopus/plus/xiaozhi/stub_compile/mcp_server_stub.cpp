// 仅用于桩编译（STUB COMPILE）：McpServer 的方法在这里是空实现，只为让链接通过。
// 真正的实现在 xiaozhi-esp32 工程 main/mcp_server.cc，本文件不能用于实机。
#include "mcp_server.h"
McpServer::McpServer() {}
McpServer::~McpServer() {}
void McpServer::AddTool(const std::string& name, const std::string& description, const PropertyList& properties, ToolCallback callback) {
  tools_.push_back(std::make_unique<McpTool>(name, description, properties, callback));
}
