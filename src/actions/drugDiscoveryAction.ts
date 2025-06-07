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

export const drugDiscoveryAction: Action = {
  name: "DRUG_DISCOVERY",
  similes: [
    "SEARCH_DRUGS",
    "FIND_COMPOUNDS", 
    "CHEMICAL_SEARCH",
    "DRUG_TARGETS",
    "PHARMACOLOGY",
    "DRUG_INTERACTIONS",
    "COMPOUND_ANALYSIS",
    "LIGAND_SEARCH"
  ],
  description: DOMAIN_DESCRIPTIONS.drugDiscovery,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) return false;

    // Check if any servers are connected
    const servers = mcpService.getServers();
    if (servers.length === 0 || !servers.some(server => server.status === "connected")) {
      return false;
    }

    // 💊 Check if this domain has any available tools
    const fullMcpProvider = mcpService.getProviderData();
    return isDomainAvailable(fullMcpProvider, "drugDiscovery");
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

    // 💊 Filter provider data to only drug discovery tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "drugDiscovery");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`💊 Drug discovery tool selection prompt: ${toolSelectionPrompt}`);

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
        "I'm having trouble figuring out the best way to help with your drug discovery request. Could you provide more details about what compounds or targets you're interested in?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific drug discovery tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate drug discovery tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(`💊 Selected drug tool "${toolName}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `💊 Called drug tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
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
          text: "Can you find information about aspirin and its targets?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll help you find information about aspirin and its pharmacological targets. Let me search through our drug databases...",
          actions: ["DRUG_DISCOVERY"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I found comprehensive information about aspirin:\n\n**Compound Information:**\n- Name: Aspirin (Acetylsalicylic acid)\n- Molecular Formula: C9H8O4\n- Molecular Weight: 180.16 g/mol\n- InChIKey: BSYNRYMUTXBXSQ-UHFFFAOYSA-N\n\n**Primary Targets:**\n- COX-1 (Cyclooxygenase-1): Irreversible inhibition\n- COX-2 (Cyclooxygenase-2): Inhibition at higher doses\n\n**Therapeutic Effects:**\n- Anti-inflammatory\n- Analgesic (pain relief)\n- Antipyretic (fever reduction)\n- Antiplatelet (blood thinning)\n\n**Mechanism:** Aspirin irreversibly acetylates serine residues in cyclooxygenase enzymes, blocking prostaglandin synthesis.",
          actions: ["DRUG_DISCOVERY"],
        },
      },
    ],
  ],
}; 