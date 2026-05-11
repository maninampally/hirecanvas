import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const DICE_MCP_URL = "https://mcp.dice.com/mcp";

// Persistent connection state
let globalClient: Client | null = null;
let isConnecting = false;

// Simple TTL Cache (10 minutes)
const cache = new Map<string, { data: Array<{ [key: string]: unknown }>, expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; 

async function getDiceClient(): Promise<Client> {
  if (globalClient) return globalClient;

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (globalClient) return globalClient;
    }
  }

  isConnecting = true;
  console.log(`[DiceMCP] Establishing persistent connection to ${DICE_MCP_URL}...`);

  try {
    const transport = new SSEClientTransport(new URL(DICE_MCP_URL));
    const client = new Client(
      { name: "hirecanvas-discovery", version: "1.0.0" },
      { capabilities: {} }
    );

    // Set a timeout for the initial cold-start connection
    const connectionTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Dice MCP Cold Start Timeout (45s)")), 45000)
    );

    await Promise.race([
      client.connect(transport),
      connectionTimeout
    ]);

    console.log("[DiceMCP] Persistent connection established.");

    // Handle disconnections
    transport.onclose = () => {
      console.warn("[DiceMCP] Connection closed. Client will reset.");
      globalClient = null;
    };

    globalClient = client;
    return client;
  } catch (err) {
    console.error("[DiceMCP] Persistent connection failed:", err);
    throw err;
  } finally {
    isConnecting = false;
  }
}

export async function searchDiceJobs(query: string, location: string = "Remote"): Promise<Array<{ [key: string]: unknown }>> {
  const cacheKey = `${query.toLowerCase()}-${location.toLowerCase()}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    console.log(`[DiceMCP] Cache hit for: ${query}`);
    return cached.data;
  }

  try {
    const client = await getDiceClient();
    console.log(`[DiceMCP] Calling 'find-jobs' for: ${query}`);

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
    
    // Store in cache
    cache.set(cacheKey, {
      data: jobs,
      expiry: Date.now() + CACHE_TTL
    });

    console.log(`[DiceMCP] Found ${jobs.length} jobs for: ${query}`);
    return jobs;
  } catch (error) {
    console.error(`[DiceMCP] Search failed for ${query}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
