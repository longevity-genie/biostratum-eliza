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

export const agingResearchAction: Action = {
  name: "AGING_RESEARCH_TOOL_CALL",
  similes: [
    "LONGEVITY_RESEARCH_TOOL_CALL",
    "AGING_GENES_TOOL_CALL", 
    "LIFESPAN_ANALYSIS_TOOL_CALL",
    "SYNERGY_AGE_TOOL_CALL",
    "OPENGENES_TOOL_CALL",
    "AGING_INTERVENTIONS_TOOL_CALL",
    "GENETIC_SYNERGY_TOOL_CALL",
    "LONGEVITY_DATABASE_TOOL_CALL"
  ],
  description: "Biostratum Aging Research - " + DOMAIN_DESCRIPTIONS.agingResearch,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    logger.info("🕰️ [VALIDATION] Starting aging research action validation");
    
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      logger.warn("🕰️ [VALIDATION] MCP service not available - validation failed");
      return false;
    }
    logger.info("🕰️ [VALIDATION] MCP service found");

    // Check if any servers are connected
    const servers = mcpService.getServers();
    logger.info(`🕰️ [VALIDATION] Found ${servers.length} MCP servers`);
    
    if (servers.length === 0) {
      logger.warn("🕰️ [VALIDATION] No MCP servers found - validation failed");
      return false;
    }

    const connectedServers = servers.filter(server => server.status === "connected");
    logger.info(`🕰️ [VALIDATION] Connected servers: ${connectedServers.length}/${servers.length}`);
    
    for (const server of servers) {
      logger.info(`🕰️ [VALIDATION] Server "${server.name || 'unnamed'}" status: ${server.status}`);
    }

    if (!servers.some(server => server.status === "connected")) {
      logger.warn("🕰️ [VALIDATION] No connected MCP servers - validation failed");
      return false;
    }

    // 🕰️ Check if this domain has any available tools
    const fullMcpProvider = mcpService.getProviderData();
    logger.info("🕰️ [VALIDATION] Retrieved MCP provider data, checking domain availability");
    
    const domainAvailable = isDomainAvailable(fullMcpProvider, "agingResearch");
    logger.info(`🕰️ [VALIDATION] Aging research domain available: ${domainAvailable}`);
    
    if (!domainAvailable) {
      logger.warn("🕰️ [VALIDATION] No aging research tools available - validation failed");
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

    // 🕰️ Filter provider data to only aging research tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "agingResearch");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`🕰️ Aging research tool selection prompt: ${toolSelectionPrompt}`);

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
        "I'm having trouble figuring out the best way to help with your aging research request. Could you provide more details about what longevity or aging data you're looking for?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific aging research tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate aging research tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(`🕰️ Selected aging tool "${toolName}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `🕰️ Called aging tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
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
          text: "What genes are known to affect lifespan in model organisms?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll search our aging research databases for genes that affect lifespan in model organisms. Let me check OpenGenes and SynergyAge databases...",
          actions: ["AGING_RESEARCH_TOOL_CALL"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I found extensive data on lifespan-affecting genes from aging research databases:\n\n**Key Longevity Genes:**\n- **daf-2** (C. elegans): Insulin/IGF-1 receptor, 2-fold lifespan extension\n- **age-1** (C. elegans): PI3K catalytic subunit, significant lifespan increase\n- **sir2** (S. cerevisiae): Sirtuin deacetylase, caloric restriction mimetic\n- **foxo** (Drosophila): Transcription factor, stress resistance\n- **p53** (Multiple species): Tumor suppressor, aging modulator\n\n**Synergistic Interactions:**\n- daf-2 + daf-16: Synergistic lifespan extension\n- sir2 + caloric restriction: Enhanced longevity effects\n- foxo + autophagy genes: Improved stress resistance\n\n**Research Context:**\nThese genes are part of conserved aging pathways including insulin/IGF-1 signaling, mTOR, and sirtuins, suggesting potential therapeutic targets for human longevity.",
          actions: ["AGING_RESEARCH_TOOL_CALL"],
        },
      },
    ],
  ],
}; 