import { type IAgentRuntime, type Plugin, logger } from "@elizaos/core";
import { agingResearchAction } from "./actions/agingResearchAction";
import { callToolAction } from "./actions/callToolAction";
import { drugDiscoveryAction } from "./actions/drugDiscoveryAction";
import { expressionAnalysisAction } from "./actions/expressionAnalysisAction";
import { geneDiscoveryAction } from "./actions/geneDiscoveryAction";
import { readResourceAction } from "./actions/readResourceAction";
import { sequenceAnalysisAction } from "./actions/sequenceAnalysisAction";
import { variantAnalysisAction } from "./actions/variantAnalysisAction";
import { provider } from "./provider";
import { McpService } from "./service";

const biostratumPlugin: Plugin = {
  name: "biostratum",
  description:
    "Biostratum MCP Orchestra - Advanced biological research toolkit with 51 specialized tools across 6 domains: gene discovery, sequence analysis, drug discovery, variant analysis, expression analysis, and aging research",

  // Required fields
  actions: [
    // Domain-specific tool call actions (optimized context)
    geneDiscoveryAction, // GENE_DISCOVERY_TOOL_CALL
    sequenceAnalysisAction, // SEQUENCE_ANALYSIS_TOOL_CALL
    drugDiscoveryAction, // DRUG_DISCOVERY_TOOL_CALL
    variantAnalysisAction, // VARIANT_ANALYSIS_TOOL_CALL
    expressionAnalysisAction, // EXPRESSION_ANALYSIS_TOOL_CALL
    agingResearchAction, // AGING_RESEARCH_TOOL_CALL
    // Generic fallback actions (disabled for testing)
    // callToolAction,           // CALL_TOOL
    readResourceAction, // READ_RESOURCE
  ],
  providers: [provider],
  services: [McpService],
  evaluators: [], // Add empty array if no evaluators

  init: async (_config: Record<string, string>, _runtime: IAgentRuntime) => {
    logger.info("🧬 Initializing Biostratum MCP Orchestra...");
  },
};

export type { McpService };

export default biostratumPlugin;
