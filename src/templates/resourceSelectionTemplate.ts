export const resourceSelectionTemplate = `
{{{mcpProvider.text}}}

{{{recentMessages}}}

# Resource Selection Instructions

You are selecting the appropriate resource to address a user's request from the MCP servers listed above.

## CRITICAL SERVER NAME REQUIREMENTS:
1. **EXACT MATCH REQUIRED**: The "serverName" in your response MUST match EXACTLY the server name shown in [SERVER NAME] above
2. **CASE SENSITIVE**: Server names are case-sensitive - "biostratum-gget" ≠ "biostratum-Gget" ≠ "gget"
3. **NO ABBREVIATIONS**: Use the complete server name as shown (e.g., "biostratum-gget", NOT "gget")
4. **NO MODIFICATIONS**: Don't add or remove prefixes, suffixes, or change formatting

## CRITICAL URI REQUIREMENTS:
1. **EXACT MATCH REQUIRED**: The "uri" must match EXACTLY the URI shown in parentheses after each resource
2. **CASE SENSITIVE**: URIs are case-sensitive and format-sensitive
3. **NO MODIFICATIONS**: Copy the exact URI including all special characters, slashes, and formatting

## Selection Process:
1. Analyze the user's request to understand their information need
2. Find the most appropriate resource based on its description and the user's request
3. If no resource seems appropriate for the request, output {"noResourceAvailable": true}

## Response Format:
- Your response MUST be valid JSON only (no code blocks, no comments, no explanatory text)
- NO code block formatting (NO backticks or \`\`\`)
- NO comments (NO // or /* */)
- NO placeholders like "replace with...", "example", "your...", "actual", etc.
- Every parameter value must be a concrete, usable value (not instructions to replace)
- Use proper JSON syntax with double quotes for strings
- NO explanatory text before or after the JSON object
- Use this exact structure:
{
  "serverName": "exact-server-name-from-list-above",
  "uri": "exact-uri-from-list-above",
  "reasoning": "Brief explanation of why this resource matches the user's request"
}

## Invalid Examples to AVOID:
❌ "serverName": "gget" (should be "biostratum-gget")
❌ "serverName": "Biostratum-gget" (wrong capitalization)
❌ "uri": "modified-uri" (must be exact match)
❌ Adding code blocks or explanatory text outside JSON

## Valid Example:
✅ {
  "serverName": "biostratum-gget",
  "uri": "gget://search/FOXO3",
  "reasoning": "User requested information about FOXO3 gene, this resource provides gene search capabilities"
}

REMEMBER: Your response will be parsed as JSON. Any deviation from pure JSON format will cause parsing failure!
`;
