#!/usr/bin/env bun

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface ServerConfig {
  name: string;
  command: string;
  args: string[];
}

interface ToolResult {
  name: string;
  description: string;
  inputSchema: any;
}

interface SuccessResult {
  server: string;
  toolCount: number;
  tools: ToolResult[];
  fetchedAt: string;
}

interface ErrorResult {
  server: string;
  error: string;
  fetchedAt: string;
}

type ServerResult = SuccessResult | ErrorResult;

const servers: ServerConfig[] = [
  {
    name: "biothings",
    command: "uvx",
    args: ["biothings-mcp"]
  },
  {
    name: "opengenes", 
    command: "uvx",
    args: ["opengenes-mcp"]
  },
  {
    name: "gget",
    command: "uvx", 
    args: ["gget-mcp"]
  }
];

async function fetchServerTools(serverConfig: ServerConfig): Promise<ServerResult> {
  console.log(`\n🔌 Connecting to ${serverConfig.name} server...`);
  
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  try {
    // Create client
    client = new Client(
      {
        name: "ElizaOS Tool Fetcher",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // Create transport
    transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      stderr: "pipe",
    });

    // Connect
    await client.connect(transport);
    console.log(`✅ Connected to ${serverConfig.name} server`);

    // Fetch tools
    console.log(`📋 Fetching tools from ${serverConfig.name}...`);
    const response = await client.listTools();
    
    const tools = response?.tools || [];
    console.log(`📊 Found ${tools.length} tools in ${serverConfig.name}`);

    // Log tool names for preview
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    });

    return {
      server: serverConfig.name,
      toolCount: tools.length,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      })),
      fetchedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Failed to connect to ${serverConfig.name}:`, error instanceof Error ? error.message : String(error));
    return {
      server: serverConfig.name,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: new Date().toISOString()
    };
  } finally {
    // Clean up connections
    try {
      if (transport) await transport.close();
      if (client) await client.close();
    } catch (cleanupError) {
      console.warn(`⚠️  Cleanup warning for ${serverConfig.name}:`, cleanupError);
    }
  }
}

async function main() {
  console.log("🚀 Biostratum MCP Tool Fetcher");
  console.log("===============================");

  // Create output directory
  const outputDir = join(process.cwd(), "data", "tools");
  mkdirSync(outputDir, { recursive: true });

  const results: ServerResult[] = [];

  // Fetch tools from each server
  for (const serverConfig of servers) {
    const result = await fetchServerTools(serverConfig);
    results.push(result);

    // Save individual server results 
    const filename = join(outputDir, `${serverConfig.name}-tools.json`);
    writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`💾 Saved ${serverConfig.name} tools to: ${filename}`);
  }

  // Save combined results
  const combinedFilename = join(outputDir, "all-biostratum-tools.json");
  const combinedResult = {
    fetchedAt: new Date().toISOString(),
    servers: results
  };
  
  writeFileSync(combinedFilename, JSON.stringify(combinedResult, null, 2));
  console.log(`💾 Saved combined results to: ${combinedFilename}`);

  // Print summary
  console.log("\n📈 Summary:");
  console.log("===========");
  results.forEach(result => {
    if ('tools' in result) {
      console.log(`${result.server}: ${result.toolCount} tools`);
    } else {
      console.log(`${result.server}: Error - ${result.error}`);
    }
  });

  console.log("\n✨ Tool fetching completed!");
}

// Run the script
main().catch(error => {
  console.error("💥 Script failed:", error);
  process.exit(1);
}); 