import {
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type State,
  logger,
} from "@elizaos/core";
import {
  DEFAULT_MAX_RETRIES,
  type McpProvider,
  type McpProviderData,
  type McpResourceInfo,
  type McpServer,
  type McpToolInfo,
} from "../types";
import { parseJSON } from "./json";

export async function withModelRetry<T>(
  initialInput: string,
  runtime: IAgentRuntime,
  validationFn: (data: unknown) => { success: true; data: T } | { success: false; error: string },
  message: Memory,
  composedState: State,
  createFeedbackPromptFn: (
    originalResponse: string,
    errorMessage: string,
    composedState: State,
    userMessage: string
  ) => string,
  callback?: HandlerCallback,
  failureMsg?: string,
  retryCount = 0
): Promise<T | null> {
  const maxRetries = getMaxRetries(runtime);

  try {
    logger.info("Raw response:", initialInput);

    const parsedJson = parseJSON<unknown>(initialInput);
    logger.info("Parsed response:", parsedJson);

    const validationResult = validationFn(parsedJson);

    if (!validationResult.success) {
      throw new Error(validationResult.error);
    }

    return validationResult.data;
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";

    logger.error("Failed to parse response:", errorMessage);

    if (retryCount < maxRetries) {
      logger.info(`Retrying (attempt ${retryCount + 1}/${maxRetries})`);

      const feedbackPrompt = createFeedbackPromptFn(
        initialInput,
        errorMessage,
        composedState,
        message.content.text || ""
      );

      const retrySelection = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: feedbackPrompt,
      });

      return withModelRetry(
        retrySelection,
        runtime,
        validationFn,
        message,
        composedState,
        createFeedbackPromptFn,
        callback,
        failureMsg,
        retryCount + 1
      );
    }

    if (callback && failureMsg) {
      await callback({
        text: failureMsg,
        thought:
          "Failed to parse response after multiple retries. Requesting clarification from user.",
        actions: ["REPLY"],
      });
    }
    return null;
  }
}

export function getMaxRetries(runtime: IAgentRuntime): number {
  try {
    const settings = runtime.getSetting("mcp");
    if (settings && "maxRetries" in settings && settings.maxRetries !== undefined) {
      const configValue = Number(settings.maxRetries);
      if (!Number.isNaN(configValue) && configValue >= 0) {
        logger.info(`Using configured selection retries: ${configValue}`);
        return configValue;
      }
    }
  } catch (error) {
    logger.debug(
      "Error reading selection retries config:",
      error instanceof Error ? error.message : String(error)
    );
  }

  return DEFAULT_MAX_RETRIES;
}

export async function handleNoSelectionAvailable<T>(
  selection: T & { noToolAvailable?: boolean; noResourceAvailable?: boolean },
  callback?: HandlerCallback,
  message = "I don't have a specific item that can help with that request. Let me try to assist you directly instead."
): Promise<boolean> {
  if (selection.noToolAvailable || selection.noResourceAvailable) {
    if (callback) {
      await callback({
        text: message,
        thought:
          "No appropriate MCP item available for this request. Falling back to direct assistance.",
        actions: ["REPLY"],
      });
    }
    return true;
  }
  return false;
}

export async function createMcpMemory(
  runtime: IAgentRuntime,
  message: Memory,
  type: string,
  serverName: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const memory = await runtime.addEmbeddingToMemory({
    entityId: message.entityId,
    agentId: runtime.agentId,
    roomId: message.roomId,
    content: {
      text: `Used the "${type}" from "${serverName}" server. 
        Content: ${content}`,
      metadata: {
        ...metadata,
        serverName,
      },
    },
  });

  await runtime.createMemory(memory, type === "resource" ? "resources" : "tools", true);
}

export function buildMcpProviderData(servers: McpServer[]): McpProvider {
  const mcpData: McpProviderData = {};
  let textContent = "";

  if (servers.length === 0) {
    return {
      values: { mcp: {} },
      data: { mcp: {} },
      text: "No MCP servers are currently connected.",
    };
  }

  textContent += "# Available MCP Servers\n\n";
  textContent +=
    "**CRITICAL**: Always use the EXACT server name shown in [SERVER NAME] - these are case-sensitive and must match exactly!\n\n";

  for (const server of servers) {
    mcpData[server.name] = {
      status: server.status,
      tools: {} as Record<string, McpToolInfo>,
      resources: {} as Record<string, McpResourceInfo>,
    };

    textContent += `## [SERVER NAME]: **${server.name}** (Status: ${server.status})\n\n`;

    if (server.tools && server.tools.length > 0) {
      textContent += "### Available Tools:\n\n";

      for (const tool of server.tools) {
        mcpData[server.name].tools[tool.name] = {
          description: tool.description || "No description available",
          inputSchema: tool.inputSchema || {},
        };

        textContent += `- **${tool.name}**: ${tool.description || "No description available"}\n`;
        if (tool.inputSchema?.properties) {
          textContent += `  Arguments: ${JSON.stringify(tool.inputSchema.properties)}\n`;
        }
      }
      textContent += "\n";
    }

    if (server.resources && server.resources.length > 0) {
      textContent += "### Available Resources:\n\n";

      for (const resource of server.resources) {
        mcpData[server.name].resources[resource.uri] = {
          name: resource.name,
          description: resource.description || "No description available",
          mimeType: resource.mimeType,
        };

        textContent += `- **${resource.name}** (URI: \`${resource.uri}\`): ${
          resource.description || "No description available"
        }\n`;
      }
      textContent += "\n";
    }
  }

  return {
    values: { mcp: mcpData },
    data: { mcp: mcpData },
    text: textContent,
  };
}
