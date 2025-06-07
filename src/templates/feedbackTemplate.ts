export const feedbackTemplate = `
{{{mcpProvider.text}}}

{{{recentMessages}}}

# JSON Correction Instructions

You previously attempted to parse a JSON selection but encountered an error. You need to fix the issues and provide a valid JSON response.

**PREVIOUS RESPONSE:**
{{{originalResponse}}}

**ERROR:**
{{{errorMessage}}}

**Available {{{itemType}}}s:**
{{{itemsDescription}}}

**User request:** "{{{userMessage}}}"

## CRITICAL REQUIREMENTS FOR CORRECTION:
1. **SERVER NAMES**: Must match EXACTLY the server name shown in [SERVER NAME] - case-sensitive!
   - Use complete names like "biostratum-gget", NOT abbreviated forms like "gget"
2. **{{{itemType}}} NAMES**: Must match exactly the available {{{itemType}}} names (case-sensitive!)
3. **JSON FORMAT**: Valid JSON syntax with double quotes for keys and string values
4. **NO PLACEHOLDERS**: All values must be concrete and usable (no "example", "your-value", etc.)
5. **NO FORMATTING**: No markdown, code blocks, or explanatory text outside the JSON

## Your Corrected JSON Response:
`;
