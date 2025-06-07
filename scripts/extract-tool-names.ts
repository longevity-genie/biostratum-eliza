#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface ToolResult {
  name: string;
  description: string;
}

interface ServerResult {
  server: string;
  toolCount: number;
  tools: ToolResult[];
  fetchedAt: string;
}

interface CombinedResult {
  fetchedAt: string;
  servers: ServerResult[];
}

interface BiostratumToolConfig {
  [serverName: string]: {
    enabled: boolean;
    include: string[];
    exclude: string[];
  };
}

async function main() {
  console.log("🔧 Extracting tool names for biostratum configuration");
  console.log("=====================================================");

  // Read the combined tools data
  const dataPath = join(process.cwd(), "data", "tools", "all-biostratum-tools.json");
  const combinedData: CombinedResult = JSON.parse(readFileSync(dataPath, 'utf8'));

  // Extract tool names by server
  const toolsByServer: Record<string, string[]> = {};
  const toolDetails: Record<string, Record<string, any>> = {};

  combinedData.servers.forEach(serverResult => {
    const serverName = serverResult.server;
    
    // Check if server has tools or if there was an error
    if ('tools' in serverResult && serverResult.tools && Array.isArray(serverResult.tools)) {
      const toolNames = serverResult.tools.map(tool => tool.name);
      
      toolsByServer[serverName] = toolNames;
      toolDetails[serverName] = {};

      serverResult.tools.forEach(tool => {
        toolDetails[serverName][tool.name] = {
          description: tool.description || '',
          hasRequiredParams: (tool as any).inputSchema?.required?.length > 0,
          requiredParams: (tool as any).inputSchema?.required || []
        };
      });

      console.log(`📋 ${serverName}: ${toolNames.length} tools`);
      toolNames.forEach(name => console.log(`  - ${name}`));
    } else {
      // Server had an error
      const errorResult = serverResult as any;
      console.log(`❌ ${serverName}: ${errorResult.error || 'Unknown error'}`);
      toolsByServer[serverName] = [];
      toolDetails[serverName] = {};
    }
    console.log();
  });

  // Create biostratum configuration with explicit include lists
  const biostratumConfig: BiostratumToolConfig = {};

  Object.entries(toolsByServer).forEach(([serverName, tools]) => {
    // Map server names to biostratum config names
    let configName = serverName;
    if (serverName === 'biothings') configName = 'biothings';
    else if (serverName === 'opengenes') configName = 'opengenes';  
    else if (serverName === 'gget') configName = 'gget';
    else if (serverName === 'synergy-age') configName = 'synergy-age';
    else if (serverName === 'pharmacology') configName = 'pharmacology';

    biostratumConfig[configName] = {
      enabled: true,
      include: tools,
      exclude: []
    };
  });

  // Save summary
  const summary = {
    fetchedAt: combinedData.fetchedAt,
    totalServers: combinedData.servers.length,
    totalTools: Object.values(toolsByServer).reduce((sum, tools) => sum + tools.length, 0),
    toolsByServer,
    toolDetails
  };

  const summaryPath = join(process.cwd(), "data", "tools", "tool-names-summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`💾 Saved summary to: ${summaryPath}`);

  // Save biostratum configuration
  const configPath = join(process.cwd(), "data", "tools", "biostratum-config.json");
  writeFileSync(configPath, JSON.stringify({ biostratum: biostratumConfig }, null, 2));
  console.log(`💾 Saved biostratum config to: ${configPath}`);

  // Print example configuration
  console.log("\n📝 Example biostratum configuration:");
  console.log("====================================");
  console.log(JSON.stringify({ biostratum: biostratumConfig }, null, 2));

  console.log("\n✨ Tool name extraction completed!");
}

main().catch(error => {
  console.error("💥 Script failed:", error);
  process.exit(1);
}); 