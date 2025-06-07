import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import type { McpService } from "./service";
import { MCP_SERVICE_NAME } from "./types";

export const provider: Provider = {
  name: "BIOSTRATUM",
  description: "Biostratum MCP Orchestra - Information about connected biological research servers, tools, and resources",

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      return {
        values: { mcp: {} },
        data: { mcp: {} },
        text: "No Biostratum research servers are available.",
      };
    }

    return mcpService.getProviderData();
  },
};
