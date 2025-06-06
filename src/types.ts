import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  EmbeddedResource,
  ImageContent,
  Resource,
  ResourceTemplate,
  TextContent,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

export const MCP_SERVICE_NAME = "mcp";
export const DEFAULT_MCP_TIMEOUT_SECONDS = 60000;
export const MIN_MCP_TIMEOUT_SECONDS = 1;
export const DEFAULT_MAX_RETRIES = 2;

export interface McpToolFiltering {
  include: string[];
  exclude: string[];
}

export interface BiostratumServerConfig {
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  env?: Record<string, string>;
  timeout?: number;
  [key: string]: unknown;
}

export type BiostratumSettings = Record<string, BiostratumServerConfig>;

export type StdioMcpServerConfig = {
  type: "stdio";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutInMillis?: number;
  toolFiltering?: McpToolFiltering;
};

export type SseMcpServerConfig = {
  type: "sse";
  url: string;
  timeout?: number;
  toolFiltering?: McpToolFiltering;
};

export type McpServerConfig = StdioMcpServerConfig | SseMcpServerConfig;

export type McpSettings = {
  servers: Record<string, McpServerConfig>;
  maxRetries?: number;
};

export type McpServerStatus = "connecting" | "connected" | "disconnected";

export interface McpServer {
  name: string;
  status: McpServerStatus;
  config: string;
  error?: string;
  disabled?: boolean;
  tools?: Tool[];
  resources?: Resource[];
  resourceTemplates?: ResourceTemplate[];
}

export interface McpConnection {
  server: McpServer;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport;
}

export interface McpToolResult {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
}

export interface McpToolCallResponse {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
}

export interface McpResourceResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface McpToolInfo {
  description: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface McpResourceInfo {
  name: string;
  description: string;
  mimeType?: string;
}

export interface McpServerInfo {
  status: string;
  tools: Record<string, McpToolInfo>;
  resources: Record<string, McpResourceInfo>;
}

export type McpProvider = {
  values: { mcp: McpProviderData };
  data: { mcp: McpProviderData };
  text: string;
};

export interface McpProviderData {
  [serverName: string]: McpServerInfo;
}

export const ToolSelectionSchema = {
  type: "object",
  required: ["serverName", "toolName", "arguments"],
  properties: {
    serverName: {
      type: "string",
      minLength: 1,
      errorMessage: "serverName must not be empty",
    },
    toolName: {
      type: "string",
      minLength: 1,
      errorMessage: "toolName must not be empty",
    },
    arguments: {
      type: "object",
    },
    reasoning: {
      type: "string",
    },
    noToolAvailable: {
      type: "boolean",
    },
  },
};

export const ResourceSelectionSchema = {
  type: "object",
  required: ["serverName", "uri"],
  properties: {
    serverName: {
      type: "string",
      minLength: 1,
      errorMessage: "serverName must not be empty",
    },
    uri: {
      type: "string",
      minLength: 1,
      errorMessage: "uri must not be empty",
    },
    reasoning: {
      type: "string",
    },
    noResourceAvailable: {
      type: "boolean",
    },
  },
};
