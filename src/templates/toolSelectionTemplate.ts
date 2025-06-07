export const toolSelectionTemplate = `
{{{mcpProvider.text}}}

{{{recentMessages}}}

# Tool Selection Instructions

You are selecting the appropriate biological research tool to address a user's request from the MCP servers listed above.

## CRITICAL SERVER NAME REQUIREMENTS:
1. **EXACT MATCH REQUIRED**: The "serverName" in your response MUST match EXACTLY the server name shown in [SERVER NAME] above
2. **CASE SENSITIVE**: Server names are case-sensitive - "biostratum-gget" ≠ "biostratum-Gget" ≠ "gget"
3. **NO ABBREVIATIONS**: Use the complete server name as shown (e.g., "biostratum-gget", NOT "gget")
4. **NO MODIFICATIONS**: Don't add or remove prefixes, suffixes, or change formatting

## CRITICAL TOOL NAME REQUIREMENTS:
1. **EXACT MATCH REQUIRED**: The "toolName" must match EXACTLY the tool name shown in the tools list
2. **CASE SENSITIVE**: Tool names are case-sensitive and format-sensitive
3. **NO MODIFICATIONS**: Copy the exact tool name including underscores, dashes, and capitalization

## Selection Process:
1. Analyze the user's request to understand their core information need or task
2. Find the most appropriate tool based on its capabilities and the user's request
3. Extract ACTUAL VALUES from the conversation context for tool arguments (no placeholders!)
4. If no tool seems appropriate for the request, output {"noToolAvailable": true}

## Response Format:
- Your response MUST be valid JSON only (no code blocks, no comments, no explanatory text)
- Use this exact structure:

{
  "serverName": "exact-server-name-from-list-above",
  "toolName": "exact-tool-name-from-list-above", 
  "arguments": {
    "param1": "actual-value-from-conversation",
    "param2": "actual-value-from-conversation"
  },
  "reasoning": "Brief explanation of why this tool matches the user's request"
}

## Argument Requirements:
- Extract REAL VALUES from the conversation context
- NO placeholder values like "example", "your-value", "replace-with", etc.
- Use proper JSON types: strings in quotes, numbers without quotes, booleans as true/false
- ALWAYS use "arguments" as the key (NOT "parameters")

## Invalid Examples to AVOID:
❌ "serverName": "gget" (should be "biostratum-gget")
❌ "serverName": "Biostratum-gget" (wrong capitalization)
❌ "toolName": "Get_Info" (wrong capitalization for gget_info)
❌ "arguments": {"gene": "your-gene-here"} (placeholder value)
❌ Adding code blocks or explanatory text outside JSON

## Valid Example:
✅ {
  "serverName": "biostratum-gget",
  "toolName": "gget_search",
  "arguments": {
    "search_terms": ["FOXO3"],
    "species": "homo_sapiens",
    "limit": 1
  },
  "reasoning": "User wants to search for FOXO3 gene information, this tool provides gene search capabilities"
}

REMEMBER: Your response will be parsed as JSON. Any deviation from pure JSON format will cause parsing failure!
`;
