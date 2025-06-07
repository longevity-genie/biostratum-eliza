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
export const DOMAIN_TOOLS: DomainToolLists = {
  geneDiscovery: [
    // Biothings gene tools
    "query_genes",
    "get_gene", 
    "get_genes",
    "query_many_genes",
    "get_gene_metadata",
    // Gget gene search tools
    "gget_search",
    "gget_info",
    "gget_ref"
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
    "gget_pdb"
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
    "local_get_ligand_interactions_to_file"
  ],

  variantAnalysis: [
    // Biothings variant tools
    "query_variants",
    "get_variant",
    "get_variants", 
    "query_many_variants",
    // Gget mutation/cancer tools
    "gget_cosmic",
    "gget_mutate"
  ],

  expressionAnalysis: [
    // Gget expression and functional analysis tools
    "gget_enrichr",
    "gget_archs4",
    "gget_cellxgene", 
    "gget_elm",
    "gget_bgee",
    "gget_opentargets"
  ],

  agingResearch: [
    // OpenGenes tools
    "opengenes_get_schema_info",
    "opengenes_example_queries", 
    "opengenes_db_query",
    // SynergyAge tools
    "synergyage_get_schema_info",
    "synergyage_example_queries",
    "synergyage_db_query"
  ]
};

import type { McpProvider } from "../types";

// Filter MCP provider data to only include tools for a specific domain
export function filterProviderForDomain(
  mcpProvider: McpProvider,
  domain: keyof DomainToolLists
): McpProvider {
  console.log(`🔧 [FILTER] Starting filter for domain: ${domain}`);
  
  const domainTools = DOMAIN_TOOLS[domain];
  console.log(`🔧 [FILTER] Domain tools to match (${domainTools.length}):`, domainTools);
  
  // Deep clone the provider to avoid mutations
  const filteredProvider = JSON.parse(JSON.stringify(mcpProvider));
  console.log(`🔧 [FILTER] Cloned provider data keys:`, Object.keys(filteredProvider.data || {}));
  
  // Filter the data.mcp object to only include servers that have tools in this domain
  if (filteredProvider.data?.mcp && typeof filteredProvider.data.mcp === 'object') {
    const mcpData = filteredProvider.data.mcp as Record<string, any>;
    console.log(`🔧 [FILTER] Processing ${Object.keys(mcpData).length} servers:`, Object.keys(mcpData));
    
    const serversToRemove: string[] = [];
    
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      console.log(`🔧 [FILTER] Processing server "${serverName}"`);
      
      if (server?.tools) {
        if (Array.isArray(server.tools)) {
          // Handle array format (legacy support)
          const originalTools = server.tools.map((tool: any) => tool.name);
          console.log(`🔧 [FILTER] Server "${serverName}" original tools (${originalTools.length}) [array]:`, originalTools);
          
          // Filter tools to only those in the domain
          const filteredTools = server.tools.filter((tool: any) => {
            const isIncluded = domainTools.includes(tool.name);
            console.log(`🔧 [FILTER] Tool "${tool.name}" included: ${isIncluded}`);
            return isIncluded;
          });
          
          console.log(`🔧 [FILTER] Server "${serverName}" filtered tools (${filteredTools.length}):`, filteredTools.map((t: any) => t.name));
          
          if (filteredTools.length === 0) {
            console.log(`🔧 [FILTER] Removing server "${serverName}" - no matching tools`);
            serversToRemove.push(serverName);
          } else {
            console.log(`🔧 [FILTER] Keeping server "${serverName}" with ${filteredTools.length} filtered tools`);
            server.tools = filteredTools;
          }
        } else if (typeof server.tools === 'object') {
          // Handle object/record format (current implementation)
          const originalTools = Object.keys(server.tools);
          console.log(`🔧 [FILTER] Server "${serverName}" original tools (${originalTools.length}) [object]:`, originalTools);
          
          // Filter tools to only those in the domain
          const filteredToolsObj: Record<string, any> = {};
          let matchingToolsCount = 0;
          
          for (const toolName of originalTools) {
            const isIncluded = domainTools.includes(toolName);
            console.log(`🔧 [FILTER] Tool "${toolName}" included: ${isIncluded}`);
            if (isIncluded) {
              filteredToolsObj[toolName] = server.tools[toolName];
              matchingToolsCount++;
            }
          }
          
          console.log(`🔧 [FILTER] Server "${serverName}" filtered tools (${matchingToolsCount}):`, Object.keys(filteredToolsObj));
          
          if (matchingToolsCount === 0) {
            console.log(`🔧 [FILTER] Removing server "${serverName}" - no matching tools`);
            serversToRemove.push(serverName);
          } else {
            console.log(`🔧 [FILTER] Keeping server "${serverName}" with ${matchingToolsCount} filtered tools`);
            server.tools = filteredToolsObj;
          }
        } else {
          console.log(`🔧 [FILTER] Server "${serverName}" has tools in unexpected format (${typeof server.tools}) - removing`);
          serversToRemove.push(serverName);
        }
      } else {
        console.log(`🔧 [FILTER] Server "${serverName}" has no tools - removing`);
        serversToRemove.push(serverName);
      }
    }
    
    // Remove servers that don't have matching tools
    for (const serverName of serversToRemove) {
      delete mcpData[serverName];
    }
    
    console.log(`🔧 [FILTER] Final filtered servers:`, Object.keys(mcpData));
  } else {
    console.log(`🔧 [FILTER] No MCP data found in provider`);
  }

  // Update the text representation to reflect filtered tools
  const totalTools = domainTools.length;
  filteredProvider.text = `Available ${domain} tools (${totalTools} tools total): ${domainTools.join(', ')}`;
  console.log(`🔧 [FILTER] Updated provider text:`, filteredProvider.text);

  return filteredProvider;
}

// Get human-readable description for each domain
export const DOMAIN_DESCRIPTIONS = {
  geneDiscovery: "Search and discover genes by symbol, name, or ID. Get comprehensive gene information, perform gene lookups, and access gene metadata from multiple databases including Biothings and Ensembl.",
  
  sequenceAnalysis: "Analyze DNA, RNA, and protein sequences. Perform BLAST searches, sequence alignments, download sequences from NCBI, predict protein structures with AlphaFold, and access PDB structural data.",
  
  drugDiscovery: "Research chemical compounds, drugs, and pharmacological targets. Search chemical databases, explore drug-target interactions, and access pharmacological data from Biothings and Guide to PHARMACOLOGY.",
  
  variantAnalysis: "Analyze genetic variants, mutations, and disease associations. Query variant databases, explore cancer mutations from COSMIC, and perform mutation analysis on sequences.",
  
  expressionAnalysis: "Study gene expression patterns, perform functional enrichment analysis, explore tissue-specific expression from ARCHS4, analyze single-cell data, and investigate protein domains and interactions.",
  
  agingResearch: "Access longevity and aging research data. Query databases of aging-related genes, explore genetic interventions that affect lifespan, and analyze synergistic genetic interactions from specialized aging research databases."
} as const;

// Helper function to check if a domain has any available tools
export function isDomainAvailable(
  mcpProvider: McpProvider,
  domain: keyof DomainToolLists
): boolean {
  console.log(`🔍 [DOMAIN_CHECK] Checking availability for domain: ${domain}`);
  
  // Basic validation of provider structure
  if (!mcpProvider) {
    console.log(`🔍 [DOMAIN_CHECK] ERROR: mcpProvider is null/undefined`);
    return false;
  }
  
  if (!mcpProvider.data && !mcpProvider.values) {
    console.log(`🔍 [DOMAIN_CHECK] ERROR: mcpProvider has no data or values`);
    return false;
  }
  
  // Log the expected tools for this domain
  const expectedTools = DOMAIN_TOOLS[domain];
  console.log(`🔍 [DOMAIN_CHECK] Expected ${domain} tools (${expectedTools.length}):`, expectedTools);
  
  // Log the original provider structure
  console.log(`🔍 [DOMAIN_CHECK] Original provider data keys:`, Object.keys(mcpProvider.data || {}));
  console.log(`🔍 [DOMAIN_CHECK] Original provider values keys:`, Object.keys(mcpProvider.values || {}));
  console.log(`🔍 [DOMAIN_CHECK] Provider text:`, mcpProvider.text);
  
  if (mcpProvider.data?.mcp) {
    const mcpData = mcpProvider.data.mcp as Record<string, any>;
    console.log(`🔍 [DOMAIN_CHECK] Original MCP servers in data:`, Object.keys(mcpData));
    
    // Log all available tools across all servers
    let allTools: string[] = [];
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      console.log(`🔍 [DOMAIN_CHECK] Server "${serverName}" structure:`, {
        keys: Object.keys(server || {}),
        status: server?.status,
        toolsType: typeof server?.tools,
        toolsIsArray: Array.isArray(server?.tools),
        toolsKeys: server?.tools ? Object.keys(server.tools) : 'no tools'
      });
      
      if (server?.tools) {
        if (Array.isArray(server.tools)) {
          // Tools as array (expected by filtering logic)
          const serverTools = server.tools.map((tool: any) => tool.name);
          allTools.push(...serverTools);
          console.log(`🔍 [DOMAIN_CHECK] Server "${serverName}" has ${serverTools.length} tools (array):`, serverTools);
        } else if (typeof server.tools === 'object') {
          // Tools as object/record (actual structure from buildMcpProviderData)
          const serverTools = Object.keys(server.tools);
          allTools.push(...serverTools);
          console.log(`🔍 [DOMAIN_CHECK] Server "${serverName}" has ${serverTools.length} tools (object):`, serverTools);
        } else {
          console.log(`🔍 [DOMAIN_CHECK] Server "${serverName}" has tools in unexpected format:`, typeof server.tools);
        }
      } else {
        console.log(`🔍 [DOMAIN_CHECK] Server "${serverName}" has no tools`);
      }
    }
    console.log(`🔍 [DOMAIN_CHECK] All available tools (${allTools.length}):`, allTools);
    
    // Check which expected tools are actually available
    const availableExpectedTools = expectedTools.filter(tool => allTools.includes(tool));
    console.log(`🔍 [DOMAIN_CHECK] Available expected tools (${availableExpectedTools.length}):`, availableExpectedTools);
    const missingTools = expectedTools.filter(tool => !allTools.includes(tool));
    console.log(`🔍 [DOMAIN_CHECK] Missing expected tools (${missingTools.length}):`, missingTools);
  }
  
  const domainProvider = filterProviderForDomain(mcpProvider, domain);
  console.log(`🔍 [DOMAIN_CHECK] After filtering, provider text:`, domainProvider.text);
  
  // Count total tools available in this domain
  let totalDomainTools = 0;
  if (domainProvider.data?.mcp && typeof domainProvider.data.mcp === 'object') {
    const mcpData = domainProvider.data.mcp as Record<string, any>;
    console.log(`🔍 [DOMAIN_CHECK] Filtered MCP servers:`, Object.keys(mcpData));
    
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      if (server?.tools) {
        if (Array.isArray(server.tools)) {
          const serverToolCount = server.tools.length;
          const serverToolNames = server.tools.map((tool: any) => tool.name);
          console.log(`🔍 [DOMAIN_CHECK] Filtered server "${serverName}" has ${serverToolCount} matching tools [array]:`, serverToolNames);
          totalDomainTools += serverToolCount;
        } else if (typeof server.tools === 'object') {
          const serverToolNames = Object.keys(server.tools);
          const serverToolCount = serverToolNames.length;
          console.log(`🔍 [DOMAIN_CHECK] Filtered server "${serverName}" has ${serverToolCount} matching tools [object]:`, serverToolNames);
          totalDomainTools += serverToolCount;
        }
      }
    }
  } else {
    console.log(`🔍 [DOMAIN_CHECK] No MCP data found in filtered provider`);
  }

  console.log(`🔍 [DOMAIN_CHECK] Total domain tools found: ${totalDomainTools}`);
  const isAvailable = totalDomainTools > 0;
  console.log(`🔍 [DOMAIN_CHECK] Domain ${domain} available: ${isAvailable}`);
  
  return isAvailable;
} 