import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  logger,
} from "@elizaos/core";
import type { McpService } from "../service";
import { toolSelectionTemplate } from "../templates/toolSelectionTemplate";
import { MCP_SERVICE_NAME } from "../types";
import type { McpProvider } from "../types";
import {
  DOMAIN_DESCRIPTIONS,
  filterProviderForDomain,
  isDomainAvailable,
} from "../utils/domainFiltering";
import { handleMcpError } from "../utils/error";
import { withModelRetry } from "../utils/mcp";
import { handleToolResponse, processToolResult } from "../utils/processing";
import { createToolSelectionFeedbackPrompt, validateToolSelection } from "../utils/validation";
import type { ToolSelection } from "../utils/validation";

function createToolSelectionPrompt(state: State, mcpProvider: McpProvider): string {
  return composePromptFromState({
    state: {
      ...state,
      values: {
        ...state.values,
        mcpProvider,
      },
    },
    template: toolSelectionTemplate,
  });
}

import { composePromptFromState } from "@elizaos/core";

export const geneDiscoveryAction: Action = {
  name: "GENE_DISCOVERY_TOOL_CALL",
  similes: [
    "GENE_SEARCH_TOOL_CALL",
    "SEARCH_GENES_TOOL_CALL",
    "GENE_DISCOVERY_TOOL_CALL",
    "GENE_ANALYSIS_TOOL_CALL",
    "GENE_INFO_TOOL_CALL",
    "GENE_REFERENCE_TOOL_CALL",
  ],
  description: `Biostratum Gene Discovery - ${DOMAIN_DESCRIPTIONS.geneDiscovery}`,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    logger.info("🧬 [VALIDATION] Starting gene discovery action validation");

    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      logger.warn("🧬 [VALIDATION] MCP service not found - validation failed");
      return false;
    }
    logger.info("🧬 [VALIDATION] MCP service found");

    // Check if any servers are connected
    const servers = mcpService.getServers();
    logger.info(`🧬 [VALIDATION] Found ${servers.length} MCP servers`);

    if (servers.length === 0) {
      logger.warn("🧬 [VALIDATION] No MCP servers found - validation failed");
      return false;
    }

    const connectedServers = servers.filter((server) => server.status === "connected");
    logger.info(`🧬 [VALIDATION] Connected servers: ${connectedServers.length}/${servers.length}`);

    for (const server of servers) {
      logger.info(`🧬 [VALIDATION] Server "${server.name || "unnamed"}" status: ${server.status}`);
    }

    if (!servers.some((server) => server.status === "connected")) {
      logger.warn("🧬 [VALIDATION] No connected MCP servers - validation failed");
      return false;
    }

    // 🧬 Check if this domain has any available tools
    const fullMcpProvider = mcpService.getProviderData();
    logger.info("🧬 [VALIDATION] Retrieved MCP provider data, checking domain availability");

    const domainAvailable = isDomainAvailable(fullMcpProvider, "geneDiscovery");
    logger.info(`🧬 [VALIDATION] Gene discovery domain available: ${domainAvailable}`);

    if (!domainAvailable) {
      logger.warn("🧬 [VALIDATION] No gene discovery tools available - validation failed");
    }

    return domainAvailable;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const composedState = await runtime.composeState(message, ["RECENT_MESSAGES", "BIOSTRATUM"]);

    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      throw new Error("MCP service not available");
    }

    // 🧬 Filter provider data to only gene discovery tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "geneDiscovery");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`🧬 Gene discovery tool selection prompt: ${toolSelectionPrompt}`);

      const toolSelection = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: toolSelectionPrompt,
      });

      const parsedSelection = await withModelRetry<ToolSelection>(
        toolSelection,
        runtime,
        (data) => validateToolSelection(data, composedState),
        message,
        composedState,
        (originalResponse, errorMessage, state, userMessage) =>
          createToolSelectionFeedbackPrompt(originalResponse, errorMessage, state, userMessage),
        callback,
        "I'm having trouble figuring out the best way to help with your gene discovery request. Could you provide more details about what genes you're looking for?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific gene discovery tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate gene discovery tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(
        `🧬 Selected gene tool "${toolName}" on server "${serverName}" because: ${reasoning}`
      );

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `🧬 Called gene tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
      );

      const { toolOutput, hasAttachments, attachments } = processToolResult(
        result,
        serverName,
        toolName,
        runtime,
        message.entityId
      );

      await handleToolResponse(
        runtime,
        message,
        serverName,
        toolName,
        toolArguments,
        toolOutput,
        hasAttachments,
        attachments,
        composedState,
        mcpProvider,
        callback
      );

      return true;
    } catch (error) {
      return handleMcpError(composedState, mcpProvider, error, runtime, message, "tool", callback);
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Can you search for information about the BRCA1 gene?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll help you find information about the BRCA1 gene. Let me search through our gene databases...",
          actions: ["GENE_DISCOVERY_TOOL_CALL"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I found comprehensive information about BRCA1:\n\n**Gene Information:**\n- Symbol: BRCA1\n- Name: BRCA1 DNA repair associated\n- Ensembl ID: ENSG00000012048\n- Location: Chromosome 17 (17q21.31)\n- Type: Protein coding gene\n\n**Function:**\nBRCA1 encodes a protein involved in DNA repair and is associated with hereditary breast and ovarian cancer syndrome. Mutations in this gene significantly increase the risk of developing breast and ovarian cancers.",
          actions: ["GENE_DISCOVERY_TOOL_CALL"],
        },
      },
    ],
  ],
};
