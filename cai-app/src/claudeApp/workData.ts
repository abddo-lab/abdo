export interface SlashCommand { cmd: string; desc: string; group: string; action?: string; args?: string; }
export const slashCommands: SlashCommand[] = [
  { cmd: "/clear", desc: "Clear the conversation", group: "Session", action: "clear" },
  { cmd: "/compact", desc: "Summarise history to reclaim context", group: "Session", action: "compact" },
  { cmd: "/export", desc: "Export this thread to markdown", group: "Session" },
  { cmd: "/cost", desc: "Show token usage and spend", group: "Session", action: "cost" },
  { cmd: "/model", desc: "Switch the active model", group: "Config", args: "<name>" },
  { cmd: "/effort", desc: "Set reasoning effort", group: "Config", args: "<standard|extended|deep>" },
  { cmd: "/config", desc: "Open settings", group: "Config", action: "settings" },
  { cmd: "/help", desc: "List everything Caret Agent can do", group: "Help", action: "help" },
];

export interface MentionTarget { id: string; label: string; sub: string; kind: "file" | "dir" | "agent" | "symbol"; }
export const mentionTargets: MentionTarget[] = [];

export interface PlusAction { id: string; label: string; desc: string; icon: string; }
export const plusActions: PlusAction[] = [
  { id: "file", label: "Attach files", desc: "Send images, logs or docs", icon: "paperclip" },
  { id: "screenshot", label: "Capture screenshot", desc: "Grab a window or region", icon: "camera" },
  { id: "mcp", label: "Connect MCP server", desc: "Google Drive, Notion, Figma, and 17 more", icon: "plug" },
  { id: "memory", label: "Add to memory", desc: "Upload .md/.txt for persistent context", icon: "brain" },
];

export interface McpServer { id: string; name: string; desc: string; icon: string; connected: boolean; authType: "oauth" | "api_key" | "none"; }
export const mcpServers: McpServer[] = [
  { id: "google-drive", name: "Google Drive", desc: "Access and manage files", icon: "gdrive", connected: false, authType: "oauth" },
  { id: "notion", name: "Notion", desc: "Read and write pages", icon: "notion", connected: false, authType: "oauth" },
  { id: "figma", name: "Figma", desc: "Access designs and components", icon: "figma", connected: false, authType: "oauth" },
  { id: "gmail", name: "Gmail", desc: "Read and send emails", icon: "gmail", connected: false, authType: "oauth" },
  { id: "tavily", name: "Tavily", desc: "AI-powered web search", icon: "tavily", connected: false, authType: "api_key" },
  { id: "firecrawl", name: "Firecrawl", desc: "Web scraping and crawling", icon: "firecrawl", connected: false, authType: "api_key" },
  { id: "exa", name: "Exa", desc: "Semantic search engine", icon: "exa", connected: false, authType: "api_key" },
  { id: "supabase", name: "Supabase", desc: "Database, auth, and storage", icon: "supabase", connected: false, authType: "api_key" },
  { id: "vercel", name: "Vercel", desc: "Deploy and manage projects", icon: "vercel", connected: false, authType: "api_key" },
  { id: "neon", name: "Neon", desc: "Serverless Postgres", icon: "neon", connected: false, authType: "api_key" },
  { id: "docker", name: "Docker", desc: "Container management", icon: "docker", connected: false, authType: "api_key" },
  { id: "slack", name: "Slack", desc: "Team messaging", icon: "slack", connected: false, authType: "oauth" },
  { id: "elevenlabs", name: "ElevenLabs", desc: "AI voice synthesis", icon: "elevenlabs", connected: false, authType: "api_key" },
  { id: "replicate", name: "Replicate", desc: "Run ML models in the cloud", icon: "replicate", connected: false, authType: "api_key" },
];

export type SettingControl =
  | { kind: "toggle"; id: string; label: string; desc?: string; def: boolean }
  | { kind: "select"; id: string; label: string; desc?: string; options: string[]; def: string }
  | { kind: "slider"; id: string; label: string; desc?: string; min: number; max: number; step: number; def: number; unit?: string }
  | { kind: "perm"; id: string; label: string; desc?: string; def: "allow" | "ask" | "deny" };

export interface SettingsSection { id: string; title: string; icon: string; blurb: string; items: SettingControl[]; }
export const settingsSections: SettingsSection[] = [
  {
    id: "general", title: "General", icon: "sliders", blurb: "Core behaviour.",
    items: [
      { kind: "select", id: "defModel", label: "Default model", options: ["Auto", "claude-opus-5", "claude-opus-4-8", "claude-fable-5", "claude-sonnet-5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt 5.4 mini", "deepseek-v4-pro", "kimi k2.7 code", "kimi-k3", "glm-5.2", "mimo-v2.5-pro", "longcat-2.0", "gemini-3.6-flash", "gemini-3.5-flash", "minimax-m3", "creator-mini"], def: "Auto" },
      { kind: "select", id: "defMode", label: "Default mode", options: ["Interactive", "Plan", "Autopilot"], def: "Interactive" },
      { kind: "select", id: "defEffort", label: "Default effort", options: ["Zinc", "Manguzuime"], def: "Zinc" },
      { kind: "toggle", id: "autoCompact", label: "Auto-compact context", desc: "Summarise when window fills", def: true },
      { kind: "toggle", id: "memory", label: "Project memory", desc: "Remember facts across threads", def: true },
    ],
  },
  {
    id: "perms", title: "Permissions", icon: "shield", blurb: "What Caret Agent may do without asking.",
    items: [
      { kind: "perm", id: "pRead", label: "Read files", def: "allow" },
      { kind: "perm", id: "pWrite", label: "Edit files", def: "ask" },
      { kind: "perm", id: "pBash", label: "Run shell commands", def: "ask" },
      { kind: "perm", id: "pNet", label: "Network requests", def: "ask" },
      { kind: "perm", id: "pGit", label: "Git push / open PRs", def: "deny" },
    ],
  },
];

export const keybindings = [
  { action: "New thread", keys: "⌘ N" },
  { action: "Usage", keys: "⌘ 2" },
  { action: "Automations", keys: "⌘ 3" },
  { action: "Tools & agents", keys: "⌘ 4" },
  { action: "Settings", keys: "⌘ 5" },
  { action: "Toggle sidebar", keys: "⌘ B" },
  { action: "Cycle mode", keys: "⇧ ⇥" },
  { action: "Interrupt agent", keys: "esc" },
];
