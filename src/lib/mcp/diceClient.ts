import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const DICE_MCP_URL = "https://mcp.dice.com/mcp";

export async function searchDiceJobs(query: string, location: string = "Remote") {
  console.log(`[DiceMCP] Initiating connection to ${DICE_MCP_URL}`);
  
  const transport = new SSEClientTransport(new URL(DICE_MCP_URL));
  const client = new Client(
    { name: "hirecanvas-discovery", version: "1.0.0" },
    { capabilities: {} }
  );

  const connectionTimeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("Dice MCP Connection Timeout (15s)")), 15000)
  );

  try {
    console.log(`[DiceMCP] Connecting transport...`);
    await Promise.race([
      client.connect(transport),
      connectionTimeout
    ]);

    console.log(`[DiceMCP] Connection successful. Calling 'find-jobs' for: ${query}`);

    const result = await client.callTool({
      name: "find-jobs",
      arguments: {
        q: query,
        location: location,
        limit: 10
      }
    });

    if (!result.content || !Array.isArray(result.content)) {
      console.warn("[DiceMCP] Tool returned empty or invalid content");
      return [];
    }

    const textContent = result.content.find(c => c.type === 'text');
    if (!textContent || typeof textContent.text !== 'string') {
        console.warn("[DiceMCP] No text content in tool response");
        return [];
    }

    // Sometimes MCP tools return JSON strings inside the text block
    try {
      const data = JSON.parse(textContent.text);
      const jobs = data.jobs || data.jobListings || (Array.isArray(data) ? data : []);
      console.log(`[DiceMCP] Successfully parsed ${jobs.length} jobs`);
      return jobs;
    } catch (parseError) {
      console.error("[DiceMCP] Failed to parse tool result as JSON:", textContent.text.slice(0, 100));
      return [];
    }
  } catch (error) {
    console.error("[DiceMCP] Error during tool call:", error instanceof Error ? error.message : String(error));
    return [];
  }
}
