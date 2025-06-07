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
  const domainTools = DOMAIN_TOOLS[domain];
  
  // Deep clone the provider to avoid mutations
  const filteredProvider = JSON.parse(JSON.stringify(mcpProvider));
  
  // Filter the data.mcp object to only include servers that have tools in this domain
  if (filteredProvider.data?.mcp && typeof filteredProvider.data.mcp === 'object') {
    const mcpData = filteredProvider.data.mcp as Record<string, any>;
    
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      if (server?.tools && Array.isArray(server.tools)) {
        // Filter tools to only those in the domain
        const filteredTools = server.tools.filter((tool: any) => 
          domainTools.includes(tool.name)
        );
        
        if (filteredTools.length === 0) {
          // Remove server if no tools match this domain
          delete mcpData[serverName];
        } else {
          // Update server with filtered tools
          server.tools = filteredTools;
        }
      }
    }
  }

  // Update the text representation to reflect filtered tools
  const totalTools = domainTools.length;
  filteredProvider.text = `Available ${domain} tools (${totalTools} tools total): ${domainTools.join(', ')}`;

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
  const domainProvider = filterProviderForDomain(mcpProvider, domain);
  
  // Count total tools available in this domain
  let totalDomainTools = 0;
  if (domainProvider.data?.mcp && typeof domainProvider.data.mcp === 'object') {
    const mcpData = domainProvider.data.mcp as Record<string, any>;
    for (const serverName of Object.keys(mcpData)) {
      const server = mcpData[serverName];
      if (server?.tools && Array.isArray(server.tools)) {
        totalDomainTools += server.tools.length;
      }
    }
  }

  return totalDomainTools > 0;
} 