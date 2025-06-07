import { type IAgentRuntime, type Plugin, logger } from "@elizaos/core";
import { callToolAction } from "./actions/callToolAction";
import { readResourceAction } from "./actions/readResourceAction";
import { geneDiscoveryAction } from "./actions/geneDiscoveryAction";
import { sequenceAnalysisAction } from "./actions/sequenceAnalysisAction";
import { drugDiscoveryAction } from "./actions/drugDiscoveryAction";
import { variantAnalysisAction } from "./actions/variantAnalysisAction";
import { expressionAnalysisAction } from "./actions/expressionAnalysisAction";
import { agingResearchAction } from "./actions/agingResearchAction";
import { provider } from "./provider";
import { McpService } from "./service";

const mcpPlugin: Plugin = {
  name: "mcp",
  description: "Plugin for connecting to MCP (Model Context Protocol) servers",
  
  // Required fields
  actions: [
    // Domain-specific actions (optimized context)
    geneDiscoveryAction,
    sequenceAnalysisAction, 
    drugDiscoveryAction,
    variantAnalysisAction,
    expressionAnalysisAction,
    agingResearchAction,
    // Generic fallback actions
    callToolAction, 
    readResourceAction
  ],
  providers: [provider],
  services: [McpService],
  evaluators: [], // Add empty array if no evaluators

  init: async (_config: Record<string, string>, _runtime: IAgentRuntime) => {
    logger.info("Initializing MCP plugin...");
  },
};

export type { McpService };

export default mcpPlugin;
