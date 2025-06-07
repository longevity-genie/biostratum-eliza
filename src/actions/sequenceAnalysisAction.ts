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

export const sequenceAnalysisAction: Action = {
  name: "SEQUENCE_ANALYSIS_TOOL_CALL",
  similes: [
    "ANALYZE_SEQUENCES_TOOL_CALL",
    "SEQUENCE_BLAST_TOOL_CALL",
    "PROTEIN_STRUCTURE_TOOL_CALL", 
    "DNA_ANALYSIS_TOOL_CALL",
    "PROTEIN_ANALYSIS_TOOL_CALL",
    "ALPHAFOLD_PREDICT_TOOL_CALL",
    "SEQUENCE_ALIGNMENT_TOOL_CALL",
    "DOWNLOAD_SEQUENCES_TOOL_CALL"
  ],
  description: "Biostratum Sequence Analysis - " + DOMAIN_DESCRIPTIONS.sequenceAnalysis,

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
    return isDomainAvailable(fullMcpProvider, "sequenceAnalysis");
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

    // 🧬 Filter provider data to only sequence analysis tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "sequenceAnalysis");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`🧬 Sequence analysis tool selection prompt: ${toolSelectionPrompt}`);

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
        "I'm having trouble figuring out the best way to help with your sequence analysis request. Could you provide more details about what sequences you want to analyze?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific sequence analysis tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate sequence analysis tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(`🧬 Selected sequence tool "${toolName}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `🧬 Called sequence tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
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
          text: "Can you predict the 3D structure of this protein sequence: MKWVTFISLLLLFSSAYS",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll help you predict the 3D structure of that protein sequence using AlphaFold. Let me analyze the sequence...",
          actions: ["SEQUENCE_ANALYSIS_TOOL_CALL"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I've analyzed your protein sequence using AlphaFold structure prediction:\n\n**Sequence:** MKWVTFISLLLLFSSAYS\n**Length:** 18 amino acids\n\n**Structure Prediction Results:**\n- The sequence appears to contain a signal peptide at the N-terminus\n- Predicted secondary structure includes alpha-helical regions\n- Confidence scores indicate high reliability for the core structure\n\nThe predicted 3D coordinates and confidence scores have been generated. This appears to be a short peptide sequence that may function as a signal peptide for protein targeting.",
          actions: ["SEQUENCE_ANALYSIS_TOOL_CALL"],
        },
      },
    ],
  ],
}; 