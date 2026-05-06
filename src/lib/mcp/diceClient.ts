import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const DICE_MCP_URL = "https://mcp.dice.com/mcp";

export async function searchDiceJobs(query: string, location: string = "Remote", attempt: number = 1): Promise<any[]> {
  console.log(`[DiceMCP] Initiating connection to ${DICE_MCP_URL} (Attempt ${attempt}/2)`);

  const transport = new SSEClientTransport(new URL(DICE_MCP_URL));
  const client = new Client(
    { name: "hirecanvas-discovery", version: "1.0.0" },
    { capabilities: {} }
  );

  // Increased to 5 minutes for Dice's sometimes-slow response
  const connectionTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Dice MCP Connection Timeout (5min)")), 300000)
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
      return [];
    }

    const textContent = result.content.find(c => c.type === 'text');
    if (!textContent || typeof textContent.text !== 'string') return [];

    const data = JSON.parse(textContent.text);
    const jobs = data.jobs || data.jobListings || (Array.isArray(data) ? data : []);
    console.log(`[DiceMCP] Successfully parsed ${jobs.length} jobs`);
    return jobs;
  } catch (error) {
    console.error(`[DiceMCP] Error (Attempt ${attempt}):`, error instanceof Error ? error.message : String(error));

    // Auto-retry once
    if (attempt < 2) {
      console.log("[DiceMCP] Retrying in 2 seconds...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      return searchDiceJobs(query, location, attempt + 1);
    }

    return [];
  }
}
