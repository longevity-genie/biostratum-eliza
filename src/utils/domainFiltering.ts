// Domain-specific tool filtering utilities

export interface DomainToolLists {
  geneDiscovery: string[];
  sequenceAnalysis: string[];
  drugDiscovery: string[];
  variantAnalysis: string[];
  expressionAnalysis: string[];
  agingResearch: string[];
}

// Static tool lists for each domain
export const DOMAIN_TOOLS: Record<string, string[]> = {
  geneDiscovery: [
    // Biothings gene tools
    "query_genes",
    "get_gene",
    "get_genes",
    "query_many_genes",
    // Gget gene tools
    "gget_search",
    "gget_info",
    "gget_ref",
  ],

  sequenceAnalysis: [
    // Biothings sequence tools
    "download_entrez_data",
    "perform_pairwise_alignment",
    // Gget sequence analysis tools
    "gget_seq",
    "gget_blast",
    "gget_blat",
    "gget_muscle",
    "gget_diamond",
    "gget_alphafold",
    "gget_pdb",
  ],

  drugDiscovery: [
    // Biothings chemical tools
    "query_chems",
    "get_chem",
    "get_chems",
    "query_many_chemicals",
    // Pharmacology tools
    "list_targets",
    "list_ligands",
    "list_interactions",
    "local_search_targets_to_file",
    "local_search_ligands_to_file",
    "local_get_target_interactions_to_file",
    "local_get_ligand_interactions_to_file",
  ],

  variantAnalysis: [
    // Biothings variant tools
    "query_variants",
    "get_variant",
    "get_variants",
    "query_many_variants",
    // Gget mutation/cancer tools
    "gget_cosmic",
    "gget_mutate",
  ],

  expressionAnalysis: [
    // Gget expression and functional analysis tools
    "gget_enrichr",
    "gget_archs4",
    "gget_cellxgene",
    "gget_elm",
    "gget_bgee",
    "gget_opentargets",
  ],

  agingResearch: [
    // OpenGenes tools
    "opengenes_get_schema_info",
    "opengenes_example_queries",
    "opengenes_db_query",
    // SynergyAge tools
    "synergyage_get_schema_info",
    "synergyage_example_queries",
    "synergyage_db_query",
  ],
};

import type { McpProvider } from "../types";

// Filter MCP provider data to only include tools for a specific domain
export function filterProviderForDomain(mcpProvider: McpProvider, domain: string): McpProvider {
  console.log(`🔧 [FILTER] Starting filter for domain: ${domain}`);

  const domainTools = DOMAIN_TOOLS[domain];
  console.log(`🔧 [FILTER] Domain tools to match (${domainTools.length}):`, domainTools);

  // Deep clone the provider to avoid mutations
  const filteredProvider = JSON.parse(JSON.stringify(mcpProvider));
  console.log("🔧 [FILTER] Cloned provider data keys:", Object.keys(filteredProvider.data || {}));

  // Filter the data.mcp object to only include servers that have tools in this domain
  if (filteredProvider.data?.mcp && typeof filteredProvider.data.mcp === "object") {
    const mcpData = filteredProvider.data.mcp as Record<string, unknown>;
    console.log(
      `🔧 [FILTER] Processing ${Object.keys(mcpData).length} servers:`,
      Object.keys(mcpData)
    );

    const serversToRemove: string[] = [];

    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      console.log(`🔧 [FILTER] Processing server "${serverName}"`);

      if (server && typeof server === "object" && "tools" in server) {
        const serverWithTools = server as { tools: unknown };
        if (Array.isArray(serverWithTools.tools)) {
          // Handle array format (legacy support)
          const originalTools = serverWithTools.tools.map((tool: { name: string }) => tool.name);
          console.log(
            `🔧 [FILTER] Server "${serverName}" original tools (${originalTools.length}) [array]:`,
            originalTools
          );

          // Filter tools to only those in the domain
          const filteredTools = serverWithTools.tools.filter((tool: { name: string }) => {
            const isIncluded = domainTools.includes(tool.name);
            console.log(`🔧 [FILTER] Tool "${tool.name}" included: ${isIncluded}`);
            return isIncluded;
          });

          console.log(
            `🔧 [FILTER] Server "${serverName}" filtered tools (${filteredTools.length}):`,
            filteredTools.map((t: { name: string }) => t.name)
          );

          if (filteredTools.length === 0) {
            console.log(`🔧 [FILTER] Removing server "${serverName}" - no matching tools`);
            serversToRemove.push(serverName);
          } else {
            console.log(
              `🔧 [FILTER] Keeping server "${serverName}" with ${filteredTools.length} filtered tools`
            );
            serverWithTools.tools = filteredTools;
          }
        } else if (typeof serverWithTools.tools === "object") {
          // Handle object/record format (current implementation)
          const originalTools = Object.keys(serverWithTools.tools as Record<string, unknown>);
          console.log(
            `🔧 [FILTER] Server "${serverName}" original tools (${originalTools.length}) [object]:`,
            originalTools
          );

          // Filter tools to only those in the domain
          const filteredToolsObj: Record<string, unknown> = {};
          let matchingToolsCount = 0;

          for (const toolName of originalTools) {
            if (domainTools.includes(toolName)) {
              const toolsRecord = serverWithTools.tools as Record<string, unknown>;
              filteredToolsObj[toolName] = toolsRecord[toolName];
              matchingToolsCount++;
              console.log(`🔧 [FILTER] Tool "${toolName}" included: true`);
            } else {
              console.log(`🔧 [FILTER] Tool "${toolName}" included: false`);
            }
          }

          console.log(
            `🔧 [FILTER] Server "${serverName}" filtered tools (${matchingToolsCount}):`,
            Object.keys(filteredToolsObj)
          );

          if (matchingToolsCount === 0) {
            console.log(`🔧 [FILTER] Removing server "${serverName}" - no matching tools`);
            serversToRemove.push(serverName);
          } else {
            console.log(
              `🔧 [FILTER] Keeping server "${serverName}" with ${matchingToolsCount} filtered tools`
            );
            serverWithTools.tools = filteredToolsObj;
          }
        } else {
          console.log(`🔧 [FILTER] Server "${serverName}" has no recognizable tools format`);
          serversToRemove.push(serverName);
        }
      } else {
        console.log(`🔧 [FILTER] Server "${serverName}" has no tools property`);
        serversToRemove.push(serverName);
      }
    }

    // Remove servers that don't have any tools in this domain
    for (const serverName of serversToRemove) {
      delete mcpData[serverName];
    }

    console.log("🔧 [FILTER] Final filtered servers:", Object.keys(mcpData));
  } else {
    console.log("🔧 [FILTER] No MCP data found in provider");
  }

  // Update provider text to reflect the filtered domain
  const totalTools = domainTools.length;
  filteredProvider.text = `Available ${domain} tools (${totalTools} tools total): ${domainTools.join(", ")}`;
  console.log("🔧 [FILTER] Updated provider text:", filteredProvider.text);

  return filteredProvider;
}

// Get human-readable description for each domain
export const DOMAIN_DESCRIPTIONS = {
  geneDiscovery:
    "Search and discover genes by symbol, name, or ID. Get comprehensive gene information, perform gene lookups, and access gene metadata from multiple databases including Biothings and Ensembl.",

  sequenceAnalysis:
    "Analyze DNA, RNA, and protein sequences. Perform BLAST searches, sequence alignments, download sequences from NCBI, predict protein structures with AlphaFold, and access PDB structural data.",

  drugDiscovery:
    "Research chemical compounds, drugs, and pharmacological targets. Search chemical databases, explore drug-target interactions, and access pharmacological data from Biothings and Guide to PHARMACOLOGY.",

  variantAnalysis:
    "Analyze genetic variants, mutations, and disease associations. Query variant databases, explore cancer mutations from COSMIC, and perform mutation analysis on sequences.",

  expressionAnalysis:
    "Study gene expression patterns, perform functional enrichment analysis, explore tissue-specific expression from ARCHS4, analyze single-cell data, and investigate protein domains and interactions.",

  agingResearch:
    "Access longevity and aging research data. Query databases of aging-related genes, explore genetic interventions that affect lifespan, and analyze synergistic genetic interactions from specialized aging research databases.",
} as const;

// Helper function to check if a domain has any available tools
export function isDomainAvailable(mcpProvider: McpProvider, domain: string): boolean {
  console.log(`🔍 [DOMAIN_CHECK] Checking availability for domain: ${domain}`);

  // Basic validation of provider structure
  if (!mcpProvider) {
    console.log("🔍 [DOMAIN_CHECK] ERROR: mcpProvider is null/undefined");
    return false;
  }

  if (!mcpProvider.data && !mcpProvider.values) {
    console.log("🔍 [DOMAIN_CHECK] ERROR: mcpProvider has no data or values");
    return false;
  }

  const domainTools = DOMAIN_TOOLS[domain];
  if (!domainTools || domainTools.length === 0) {
    console.log(`🔍 [DOMAIN_CHECK] ERROR: No tools defined for domain "${domain}"`);
    return false;
  }

  // Log the original provider structure
  console.log(
    "🔍 [DOMAIN_CHECK] Original provider data keys:",
    Object.keys(mcpProvider.data || {})
  );
  console.log(
    "🔍 [DOMAIN_CHECK] Original provider values keys:",
    Object.keys(mcpProvider.values || {})
  );
  console.log("🔍 [DOMAIN_CHECK] Provider text:", mcpProvider.text);

  if (mcpProvider.data?.mcp) {
    const mcpData = mcpProvider.data.mcp as Record<string, unknown>;
    console.log("🔍 [DOMAIN_CHECK] Original MCP servers in data:", Object.keys(mcpData));

    // Log all available tools across all servers
    const allTools: string[] = [];
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      if (server && typeof server === "object" && "tools" in server) {
        const serverWithTools = server as { tools: unknown };
        if (Array.isArray(serverWithTools.tools)) {
          // Tools as array (expected by filtering logic)
          const serverTools = serverWithTools.tools.map((tool: { name: string }) => tool.name);
          allTools.push(...serverTools);
          console.log(
            `🔍 [DOMAIN_CHECK] Server "${serverName}" has ${serverTools.length} tools (array):`,
            serverTools
          );
        } else if (typeof serverWithTools.tools === "object" && serverWithTools.tools !== null) {
          // Tools as object/record
          const serverTools = Object.keys(serverWithTools.tools as Record<string, unknown>);
          allTools.push(...serverTools);
          console.log(
            `🔍 [DOMAIN_CHECK] Server "${serverName}" has ${serverTools.length} tools (object):`,
            serverTools
          );
        }
      }
    }

    console.log(
      `🔍 [DOMAIN_CHECK] All available tools across servers (${allTools.length}):`,
      allTools
    );
    console.log(
      `🔍 [DOMAIN_CHECK] Domain tools needed for "${domain}" (${domainTools.length}):`,
      domainTools
    );

    // Check if any domain tools are available
    const availableTools = domainTools.filter((tool) => allTools.includes(tool));
    console.log(
      `🔍 [DOMAIN_CHECK] Available domain tools (${availableTools.length}):`,
      availableTools
    );

    const domainProvider = filterProviderForDomain(mcpProvider, domain);
    console.log("🔍 [DOMAIN_CHECK] After filtering, provider text:", domainProvider.text);

    // Count total tools available in this domain
    let totalDomainTools = 0;
    if (domainProvider.data?.mcp && typeof domainProvider.data.mcp === "object") {
      const mcpData = domainProvider.data.mcp as Record<string, unknown>;
      console.log("🔍 [DOMAIN_CHECK] Filtered MCP servers:", Object.keys(mcpData));

      for (const serverName of Object.keys(mcpData)) {
        const server = mcpData[serverName];
        if (server && typeof server === "object" && "tools" in server) {
          const serverWithTools = server as { tools: unknown };
          if (Array.isArray(serverWithTools.tools)) {
            totalDomainTools += serverWithTools.tools.length;
            console.log(
              `🔍 [DOMAIN_CHECK] Server "${serverName}" contributes ${serverWithTools.tools.length} domain tools`
            );
          } else if (typeof serverWithTools.tools === "object" && serverWithTools.tools !== null) {
            const toolCount = Object.keys(serverWithTools.tools as Record<string, unknown>).length;
            totalDomainTools += toolCount;
            console.log(
              `🔍 [DOMAIN_CHECK] Server "${serverName}" contributes ${toolCount} domain tools`
            );
          }
        }
      }
    }

    console.log(`🔍 [DOMAIN_CHECK] Total domain tools available: ${totalDomainTools}`);
    const isAvailable = totalDomainTools > 0;
    console.log(`🔍 [DOMAIN_CHECK] Domain "${domain}" available: ${isAvailable}`);

    return isAvailable;
  }

  console.log("🔍 [DOMAIN_CHECK] No MCP data found in provider, checking values...");

  // Fallback check in values if no data.mcp
  if (mcpProvider.values) {
    console.log("🔍 [DOMAIN_CHECK] Provider values keys:", Object.keys(mcpProvider.values));
    // This would need more specific logic based on the values structure
    return false;
  }

  console.log("🔍 [DOMAIN_CHECK] No usable data found in provider");
  return false;
}
