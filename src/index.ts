import { type IAgentRuntime, type Plugin, logger } from "@elizaos/core";
import { callToolAction } from "./actions/callToolAction";
import { readResourceAction } from "./actions/readResourceAction";
import { provider } from "./provider";
import { McpService } from "./service";

const mcpPlugin: Plugin = {
  name: "mcp",
  description: "Plugin for connecting to MCP (Model Context Protocol) servers",
  
  // Required fields
  actions: [callToolAction, readResourceAction],
  providers: [provider],
  services: [McpService],
  evaluators: [], // Add empty array if no evaluators

  init: async (_config: Record<string, string>, _runtime: IAgentRuntime) => {
    logger.info("Initializing MCP plugin...");
  },
};

export type { McpService };

export default mcpPlugin;
