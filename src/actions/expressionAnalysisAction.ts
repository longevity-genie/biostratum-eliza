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

export const expressionAnalysisAction: Action = {
  name: "EXPRESSION_ANALYSIS_TOOL_CALL",
  similes: [
    "GENE_EXPRESSION_TOOL_CALL",
    "ENRICHMENT_ANALYSIS_TOOL_CALL", 
    "TISSUE_EXPRESSION_TOOL_CALL",
    "SINGLE_CELL_ANALYSIS_TOOL_CALL",
    "FUNCTIONAL_ANALYSIS_TOOL_CALL",
    "PATHWAY_ANALYSIS_TOOL_CALL",
    "PROTEIN_DOMAINS_TOOL_CALL",
    "CELL_TYPE_ANALYSIS_TOOL_CALL"
  ],
  description: "Biostratum Expression Analysis - " + DOMAIN_DESCRIPTIONS.expressionAnalysis,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    logger.info("📊 [VALIDATION] Starting expression analysis action validation");
    
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) {
      logger.warn("📊 [VALIDATION] MCP service not available - validation failed");
      return false;
    }
    logger.info("📊 [VALIDATION] MCP service found");

    // Check if any servers are connected
    const servers = mcpService.getServers();
    logger.info(`📊 [VALIDATION] Found ${servers.length} MCP servers`);
    
    if (servers.length === 0) {
      logger.warn("📊 [VALIDATION] No MCP servers found - validation failed");
      return false;
    }

    const connectedServers = servers.filter(server => server.status === "connected");
    logger.info(`📊 [VALIDATION] Connected servers: ${connectedServers.length}/${servers.length}`);
    
    for (const server of servers) {
      logger.info(`📊 [VALIDATION] Server "${server.name || 'unnamed'}" status: ${server.status}`);
    }

    if (!servers.some(server => server.status === "connected")) {
      logger.warn("📊 [VALIDATION] No connected MCP servers - validation failed");
      return false;
    }

    // 📊 Check if this domain has any available tools
    const fullMcpProvider = mcpService.getProviderData();
    logger.info("📊 [VALIDATION] Retrieved MCP provider data, checking domain availability");
    
    const domainAvailable = isDomainAvailable(fullMcpProvider, "expressionAnalysis");
    logger.info(`📊 [VALIDATION] Expression analysis domain available: ${domainAvailable}`);
    
    if (!domainAvailable) {
      logger.warn("📊 [VALIDATION] No expression analysis tools available - validation failed");
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

    // 📊 Filter provider data to only expression analysis tools
    const fullMcpProvider = mcpService.getProviderData();
    const mcpProvider = filterProviderForDomain(fullMcpProvider, "expressionAnalysis");

    try {
      const toolSelectionPrompt = createToolSelectionPrompt(composedState, mcpProvider);

      logger.info(`📊 Expression analysis tool selection prompt: ${toolSelectionPrompt}`);

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
        "I'm having trouble figuring out the best way to help with your expression analysis request. Could you provide more details about what genes or pathways you want to analyze?"
      );

      if (!parsedSelection || parsedSelection.noToolAvailable) {
        if (callback && parsedSelection?.noToolAvailable) {
          await callback({
            text: "I don't have a specific expression analysis tool that can help with that request. Let me try to assist you directly instead.",
            thought:
              "No appropriate expression analysis tool available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, toolName, arguments: toolArguments, reasoning } = parsedSelection;

      logger.debug(`📊 Selected expression tool "${toolName}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.callTool(serverName, toolName, toolArguments);
      logger.debug(
        `📊 Called expression tool ${toolName} on server ${serverName} with arguments ${JSON.stringify(toolArguments)}`
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
          text: "Can you analyze the tissue expression of APOE and find enriched pathways?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I'll analyze APOE tissue expression patterns and perform pathway enrichment analysis. Let me check the expression databases...",
          actions: ["EXPRESSION_ANALYSIS_TOOL_CALL"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "I've analyzed APOE expression and pathway associations:\n\n**Tissue Expression (ARCHS4 data):**\n- Highest expression: Brain (hippocampus, cortex), Liver\n- Moderate expression: Kidney, Adrenal gland\n- Low expression: Muscle, Skin\n\n**Enriched Pathways:**\n- Cholesterol metabolism (KEGG)\n- Lipid transport and metabolism\n- Alzheimer's disease pathway\n- PPAR signaling pathway\n- Complement and coagulation cascades\n\n**Functional Context:**\nAPOE shows brain-specific expression patterns consistent with its role in neurodegeneration and lipid metabolism, particularly relevant to Alzheimer's disease risk.",
          actions: ["EXPRESSION_ANALYSIS_TOOL_CALL"],
        },
      },
    ],
  ],
}; 