/**
 * MCP Server Connection Service
 * Real API connections for MCP servers — API key only, no OAuth
 */

export interface McpConnection {
  id: string;
  serverId: string;
  serverName: string;
  apiUrl: string;
  apiKey?: string;
  status: "connected" | "disconnected" | "error";
  lastUsed?: number;
  methods: McpMethod[];
}

export interface McpMethod {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
}

// Real MCP server configurations — API key only, no OAuth
export const MCP_SERVER_CONFIGS: Record<string, {
  name: string;
  apiUrl: string;
  authType: "api_key" | "none";
  methods: McpMethod[];
}> = {
  "tavily": {
    name: "Tavily",
    apiUrl: "https://api.tavily.com",
    authType: "api_key",
    methods: [
      { name: "search", description: "AI-powered web search", parameters: { query: { type: "string", description: "Search query", required: true }, searchDepth: { type: "string", description: "basic or advanced", required: false }, maxResults: { type: "number", description: "Max results", required: false } } },
      { name: "extract", description: "Extract content from URL", parameters: { urls: { type: "array", description: "URLs to extract", required: true } } },
    ],
  },
  "firecrawl": {
    name: "Firecrawl",
    apiUrl: "https://api.firecrawl.dev/v1",
    authType: "api_key",
    methods: [
      { name: "scrape", description: "Scrape a URL", parameters: { url: { type: "string", description: "URL to scrape", required: true }, formats: { type: "array", description: "Output formats", required: false } } },
      { name: "crawl", description: "Crawl a website", parameters: { url: { type: "string", description: "Starting URL", required: true }, limit: { type: "number", description: "Max pages", required: false } } },
      { name: "search", description: "Search web", parameters: { query: { type: "string", description: "Search query", required: true } } },
    ],
  },
  "exa": {
    name: "Exa",
    apiUrl: "https://api.exa.ai",
    authType: "api_key",
    methods: [
      { name: "search", description: "Semantic search", parameters: { query: { type: "string", description: "Search query", required: true }, numResults: { type: "number", description: "Number of results", required: false }, type: { type: "string", description: "neural or keyword", required: false } } },
      { name: "get_contents", description: "Get content of results", parameters: { ids: { type: "array", description: "Result IDs", required: true } } },
    ],
  },
  "supabase": {
    name: "Supabase",
    apiUrl: "https://api.supabase.com/v1",
    authType: "api_key",
    methods: [
      { name: "query", description: "Run SQL query", parameters: { project_id: { type: "string", description: "Project ID", required: true }, query: { type: "string", description: "SQL query", required: true } } },
      { name: "list_tables", description: "List database tables", parameters: { project_id: { type: "string", description: "Project ID", required: true } } },
      { name: "storage_upload", description: "Upload to storage", parameters: { project_id: { type: "string", description: "Project ID", required: true }, bucket: { type: "string", description: "Bucket name", required: true }, path: { type: "string", description: "File path", required: true }, content: { type: "string", description: "File content (base64)", required: true } } },
    ],
  },
  "vercel": {
    name: "Vercel",
    apiUrl: "https://api.vercel.com/v13",
    authType: "api_key",
    methods: [
      { name: "list_projects", description: "List projects", parameters: {} },
      { name: "get_deployment", description: "Get deployment", parameters: { deploymentId: { type: "string", description: "Deployment ID", required: true } } },
      { name: "create_deployment", description: "Create deployment", parameters: { projectId: { type: "string", description: "Project ID", required: true }, files: { type: "array", description: "Files to deploy", required: true } } },
    ],
  },
  "neon": {
    name: "Neon",
    apiUrl: "https://console.neon.tech/api/v2",
    authType: "api_key",
    methods: [
      { name: "list_projects", description: "List projects", parameters: {} },
      { name: "create_branch", description: "Create database branch", parameters: { projectId: { type: "string", description: "Project ID", required: true }, name: { type: "string", description: "Branch name", required: false } } },
      { name: "execute_query", description: "Execute SQL query", parameters: { projectId: { type: "string", description: "Project ID", required: true }, branchId: { type: "string", description: "Branch ID", required: true }, query: { type: "string", description: "SQL query", required: true } } },
    ],
  },
  "docker": {
    name: "Docker",
    apiUrl: "https://api.docker.com/v1.43",
    authType: "api_key",
    methods: [
      { name: "list_containers", description: "List containers", parameters: { all: { type: "boolean", description: "Include stopped", required: false } } },
      { name: "run_container", description: "Run a container", parameters: { image: { type: "string", description: "Docker image", required: true }, name: { type: "string", description: "Container name", required: false }, ports: { type: "object", description: "Port mappings", required: false } } },
      { name: "exec_command", description: "Execute command in container", parameters: { containerId: { type: "string", description: "Container ID", required: true }, command: { type: "string", description: "Command to run", required: true } } },
    ],
  },
  "elevenlabs": {
    name: "ElevenLabs",
    apiUrl: "https://api.elevenlabs.io/v1",
    authType: "api_key",
    methods: [
      { name: "text_to_speech", description: "Convert text to speech", parameters: { text: { type: "string", description: "Text to convert", required: true }, voice_id: { type: "string", description: "Voice ID", required: true }, model_id: { type: "string", description: "Model ID", required: false } } },
      { name: "list_voices", description: "List available voices", parameters: {} },
    ],
  },
  "replicate": {
    name: "Replicate",
    apiUrl: "https://api.replicate.com/v1",
    authType: "api_key",
    methods: [
      { name: "run_model", description: "Run a ML model", parameters: { model: { type: "string", description: "Model name (owner/name)", required: true }, input: { type: "object", description: "Model input", required: true } } },
      { name: "get_prediction", description: "Get prediction result", parameters: { predictionId: { type: "string", description: "Prediction ID", required: true } } },
      { name: "list_models", description: "List available models", parameters: { query: { type: "string", description: "Search query", required: false } } },
    ],
  },
};

// Active MCP connections
const activeConnections: Map<string, McpConnection> = new Map();

// Get stored API keys from localStorage
function getStoredApiKey(serverId: string): string | null {
  try {
    const keys = JSON.parse(localStorage.getItem("mcp_api_keys") || "{}");
    return keys[serverId] || null;
  } catch {
    return null;
  }
}

// Store API key
export function storeApiKey(serverId: string, apiKey: string): void {
  try {
    const keys = JSON.parse(localStorage.getItem("mcp_api_keys") || "{}");
    keys[serverId] = apiKey;
    localStorage.setItem("mcp_api_keys", JSON.stringify(keys));
  } catch {}
}

// Connect to MCP server (API key only)
export async function connectToMcpServer(serverId: string, apiKey?: string): Promise<McpConnection> {
  const config = MCP_SERVER_CONFIGS[serverId];
  if (!config) throw new Error(`Unknown MCP server: ${serverId}`);

  const key = apiKey || getStoredApiKey(serverId);
  if (config.authType === "api_key" && !key) {
    throw new Error(`API key required for ${config.name}. Get your API key from ${config.name.toLowerCase()} dashboard.`);
  }

  if (key) storeApiKey(serverId, key);

  const connection: McpConnection = {
    id: `conn-${serverId}-${Date.now()}`,
    serverId,
    serverName: config.name,
    apiUrl: config.apiUrl,
    apiKey: key || undefined,
    status: "connected",
    lastUsed: Date.now(),
    methods: config.methods,
  };

  activeConnections.set(serverId, connection);
  return connection;
}

// Disconnect from MCP server
export function disconnectFromMcpServer(serverId: string): void {
  activeConnections.delete(serverId);
}

// Get active connection
export function getMcpConnection(serverId: string): McpConnection | undefined {
  return activeConnections.get(serverId);
}

// Get all active connections
export function getActiveMcpConnections(): McpConnection[] {
  return Array.from(activeConnections.values());
}

// Check if any MCP is connected
export function isAnyMcpConnected(): boolean {
  return activeConnections.size > 0;
}

// Get connected MCP server IDs
export function getConnectedMcpServerIds(): string[] {
  return Array.from(activeConnections.keys());
}

// Call MCP method — real HTTP calls with API key auth only
export async function callMcpMethod(
  serverId: string,
  methodName: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const connection = activeConnections.get(serverId);
  if (!connection) throw new Error(`Not connected to ${serverId}`);

  const config = MCP_SERVER_CONFIGS[serverId];
  if (!config) throw new Error(`Unknown server config: ${serverId}`);

  const method = config.methods.find((m) => m.name === methodName);
  if (!method) throw new Error(`Unknown method: ${methodName}`);

  if (!connection.apiKey && config.authType === "api_key") {
    throw new Error(`No API key stored for ${config.name}. Connect it first.`);
  }

  // Build headers — API key only, no OAuth
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${connection.apiKey}`,
  };

  // Special headers for specific providers
  if (serverId === "notion") {
    headers["Notion-Version"] = "2022-06-28";
  }

  // Build request URL and body based on server
  let url = config.apiUrl;
  let body: string | undefined;

  switch (serverId) {
    case "tavily":
      url += "/search";
      body = JSON.stringify({ query: params.query, search_depth: params.searchDepth || "basic", max_results: params.maxResults || 5, include_answer: true, include_images: false });
      break;

    case "firecrawl":
      if (methodName === "scrape") { url += "/scrape"; body = JSON.stringify({ url: params.url, formats: params.formats || ["markdown"], onlyMainContent: true }); }
      else if (methodName === "crawl") { url += "/crawl"; body = JSON.stringify({ url: params.url, limit: params.limit || 10, modes: ["markdown"] }); }
      else if (methodName === "search") { url += "/search"; body = JSON.stringify({ query: params.query, limit: 5 }); }
      break;

    case "exa":
      if (methodName === "search") { url += "/search"; body = JSON.stringify({ query: params.query, num_results: params.numResults || 5, type: params.type || "neural", useAutoprompt: true, text: true }); }
      else if (methodName === "get_contents") { url += "/contents"; body = JSON.stringify({ ids: params.ids, text: true, highlights: true }); }
      break;

    case "supabase":
      if (methodName === "query") { url += `/projects/${params.project_id}/database/query`; body = JSON.stringify({ query: params.query }); }
      else if (methodName === "list_tables") { url += `/projects/${params.project_id}/database/tables`; }
      else if (methodName === "storage_upload") { url += `/storage/v1/object/${params.project_id}/${params.bucket}/${params.path}`; body = params.content; headers["Content-Type"] = "application/octet-stream"; }
      break;

    case "vercel":
      if (methodName === "list_projects") { url += "/projects"; }
      else if (methodName === "get_deployment") { url += `/deployments/${params.deploymentId}`; }
      else if (methodName === "create_deployment") { url += "/deployments"; body = JSON.stringify({ projectId: params.projectId, files: params.files, deploymentName: params.deploymentName || "caret-deploy" }); }
      break;

    case "neon":
      if (methodName === "list_projects") { url += "/projects"; }
      else if (methodName === "create_branch") { url += `/projects/${params.projectId}/branches`; body = JSON.stringify({ name: params.name }); }
      else if (methodName === "execute_query") { url += `/projects/${params.projectId}/branches/${params.branchId}/query`; body = JSON.stringify({ query: params.query }); }
      break;

    case "docker":
      if (methodName === "run_container") { url += "/containers/create"; body = JSON.stringify({ Image: params.image, name: params.name, HostConfig: { PortBindings: params.ports } }); }
      else if (methodName === "list_containers") { url += "/containers/json?all=true"; }
      else if (methodName === "exec_command") { url += `/containers/${params.containerId}/exec`; body = JSON.stringify({ Cmd: params.command.split(" "), AttachStdout: true, AttachStderr: true }); }
      break;

    case "elevenlabs":
      if (methodName === "text_to_speech") { url += `/text-to-speech/${params.voice_id}`; body = JSON.stringify({ text: params.text, model_id: params.model_id || "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }); }
      else if (methodName === "list_voices") { url += "/voices"; }
      break;

    case "replicate":
      if (methodName === "run_model") { url += "/predictions"; body = JSON.stringify({ version: params.model, input: params.input }); }
      else if (methodName === "get_prediction") { url += `/predictions/${params.predictionId}`; }
      else if (methodName === "list_models") { url += `/models?search=${params.query || ""}`; }
      break;

    default:
      url += `/${methodName}`;
      body = JSON.stringify(params);
  }

  // Make the real API call
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  connection.lastUsed = Date.now();
  return result;
}