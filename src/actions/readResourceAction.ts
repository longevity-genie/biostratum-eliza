import {
  type Action,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  composePromptFromState,
  logger,
} from "@elizaos/core";
import type { McpService } from "../service";
import { resourceSelectionTemplate } from "../templates/resourceSelectionTemplate";
import { MCP_SERVICE_NAME } from "../types";
import { handleMcpError } from "../utils/error";
import { withModelRetry } from "../utils/mcp";
import {
  handleResourceAnalysis,
  processResourceResult,
  sendInitialResponse,
} from "../utils/processing";
import {
  createResourceSelectionFeedbackPrompt,
  validateResourceSelection,
} from "../utils/validation";
import type { ResourceSelection } from "../utils/validation";

function createResourceSelectionPrompt(composedState: State, userMessage: string): string {
  const mcpData = composedState.values.mcp || {};
  const serverNames = Object.keys(mcpData);

  let resourcesDescription = "";
  for (const serverName of serverNames) {
    const server = mcpData[serverName];
    if (server.status !== "connected") continue;

    const resourceUris = Object.keys(server.resources || {});
    for (const uri of resourceUris) {
      const resource = server.resources[uri];
      resourcesDescription += `Resource: ${uri} (Server: ${serverName})\n`;
      resourcesDescription += `Name: ${resource.name || "No name available"}\n`;
      resourcesDescription += `Description: ${
        resource.description || "No description available"
      }\n`;
      resourcesDescription += `MIME Type: ${resource.mimeType || "Not specified"}\n\n`;
    }
  }

  const enhancedState: State = {
    ...composedState,
    values: {
      ...composedState.values,
      resourcesDescription,
      userMessage,
    },
  };

  return composePromptFromState({
    state: enhancedState,
    template: resourceSelectionTemplate,
  });
}

export const readResourceAction: Action = {
  name: "READ_RESOURCE",
  similes: [
    "READ_MCP_RESOURCE",
    "GET_RESOURCE",
    "GET_MCP_RESOURCE",
    "FETCH_RESOURCE",
    "FETCH_MCP_RESOURCE",
    "ACCESS_RESOURCE",
    "ACCESS_MCP_RESOURCE",
  ],
  description: "Reads a resource from an MCP server",

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    const mcpService = runtime.getService<McpService>(MCP_SERVICE_NAME);
    if (!mcpService) return false;

    const servers = mcpService.getServers();
    return (
      servers.length > 0 &&
      servers.some(
        (server) => server.status === "connected" && server.resources && server.resources.length > 0
      )
    );
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

    const mcpProvider = mcpService.getProviderData();

    try {
      await sendInitialResponse(callback);

      const resourceSelectionPrompt = createResourceSelectionPrompt(
        composedState,
        message.content.text || ""
      );

      const resourceSelection = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: resourceSelectionPrompt,
      });

      const parsedSelection = await withModelRetry<ResourceSelection>(
        resourceSelection,
        runtime,
        (data) => validateResourceSelection(data),
        message,
        composedState,
        (originalResponse, errorMessage, state, userMessage) =>
          createResourceSelectionFeedbackPrompt(originalResponse, errorMessage, state, userMessage),
        callback,
        "I'm having trouble figuring out where to find the information you're looking for. Could you provide more details about what you need?"
      );

      if (!parsedSelection || parsedSelection.noResourceAvailable) {
        if (callback && parsedSelection?.noResourceAvailable) {
          await callback({
            text: "I don't have a specific resource that contains the information you're looking for. Let me try to assist you directly instead.",
            thought:
              "No appropriate MCP resource available for this request. Falling back to direct assistance.",
            actions: ["REPLY"],
          });
        }
        return true;
      }

      const { serverName, uri, reasoning } = parsedSelection;

      logger.debug(`Selected resource "${uri}" on server "${serverName}" because: ${reasoning}`);

      const result = await mcpService.readResource(serverName, uri);
      logger.debug(`Read resource ${uri} from server ${serverName}`);

      const { resourceContent, resourceMeta } = processResourceResult(result, uri);

      await handleResourceAnalysis(
        runtime,
        message,
        uri,
        serverName,
        resourceContent,
        resourceMeta,
        callback
      );

      return true;
    } catch (error) {
      return handleMcpError(
        composedState,
        mcpProvider,
        error,
        runtime,
        message,
        "resource",
        callback
      );
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Can you get the documentation about installing ElizaOS?",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: `I'll retrieve that information for you. Let me access the resource...`,
          actions: ["READ_MCP_RESOURCE"],
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: `ElizaOS installation is straightforward. You'll need Node.js 23+ and Git installed. For Windows users, WSL 2 is required. The quickest way to get started is by cloning the ElizaOS starter repository with \`git clone https://github.com/elizaos/eliza-starter.git\`, then run \`cd eliza-starter && cp .env.example .env && bun i && bun run build && bun start\`. This will set up a development environment with the core features enabled. After starting, you can access the web interface at http://localhost:3000 to interact with your agent.`,
          actions: ["READ_MCP_RESOURCE"],
        },
      },
    ],
  ],
};
