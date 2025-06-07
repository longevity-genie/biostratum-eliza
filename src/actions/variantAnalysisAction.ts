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
import { handleMcpError } from "../utils/error";
import { withModelRetry } from "../utils/mcp";
import { handleToolResponse, processToolResult } from "../utils/processing";
import { createToolSelectionFeedbackPrompt, validateToolSelection } from "../utils/validation";
import type { ToolSelection } from "../utils/validation";
import { filterProviderForDomain, DOMAIN_DESCRIPTIONS, isDomainAvailable } from "../utils/domainFiltering";
import type { McpProvider } from "../types";

function createToolSelectionPrompt(
  state: State,
  mcpProvider: McpProvider
): string {
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

export const variantAnalysisAction: Action = {
  name: "VARIANT_ANALYSIS",
  similes: [
    "ANALYZE_VARIANTS",
    "SEARCH_MUTATIONS", 
    "VARIANT_SEARCH",
    "MUTATION_ANALYSIS",
    "CANCER_MUTATIONS",
    "COSMIC_SEARCH",
    "SNP_ANALYSIS",
    "GENETIC_VARIANTS"
  ],
  description: DOMAIN_DESCRIPTIONS.variantAnalysis,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) return false;

    // Check if any servers are connected
    const servers = mcpService.getServers();
    if (servers.length === 0 || !servers.some(server => server.status === "connected")) {
      return false;
    }

    // 🧬 Check if this domain has any available tools
    const fullMcpProvider = mcpService.getProviderData();
    return isDomainAvailable(fullMcpProvider, "variantAnalysis");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const composedState = await runtime.composeState(message, ["RECENT_MESSAGES", "MCP"]);

    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      throw new Error("MCP service not available");
    }

    // 🧬 Filter provider data to only variant analysis tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "variantAnalysis");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`🧬 Variant analysis tool selection prompt: ${toolSelectionPrompt}`);

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
        "I'm having trouble figuring out the best way to help with your variant analysis request. Could you provide more details about what genetic variants you want to analyze?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific variant analysis tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate variant analysis tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(`🧬 Selected variant tool "${toolName}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `🧬 Called variant tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
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
          text: "What mutations are found in TP53 in cancer?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll search for TP53 mutations in cancer databases. Let me check the COSMIC database for cancer mutations...",
          actions: ["VARIANT_ANALYSIS"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I found extensive mutation data for TP53 in cancer:\n\n**TP53 Cancer Mutations:**\n- Total mutations found: 28,000+ entries in COSMIC\n- Most common mutation types: Missense mutations (60%), nonsense mutations (20%)\n- Hotspot mutations: R175H, R248Q, R273H, G245S\n- Cancer types: Found in >50% of all cancers\n\n**Key Mutation Effects:**\n- R175H: Loss of DNA-binding function\n- R248Q: Dominant negative effect\n- R273H: Impaired transcriptional activity\n\n**Functional Impact:**\nMost TP53 mutations result in loss of tumor suppressor function, leading to impaired DNA damage response and cell cycle control.",
          actions: ["VARIANT_ANALYSIS"],
        },
      },
    ],
  ],
}; 