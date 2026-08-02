// src/api.ts — Frontend API client for Kiren backend
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== "undefined" && window.location.protocol === "https:"
    ? "wss://localhost:3001/ws"
    : "ws://localhost:3001/ws");

function getToken(): string | null {
  return localStorage.getItem("kiren_token");
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  deviceCode: () => request("/auth/device/code", { method: "POST" }),
  devicePoll: (device_code: string) =>
    request("/auth/device/poll", { method: "POST", body: JSON.stringify({ device_code }) }),
  session: () => request("/auth/session"),
  demoLogin: () => request("/auth/demo-login", { method: "POST" }),
  logout: () => request("/auth/logout", { method: "POST" }),
};

// ── User ──────────────────────────────────────────────────────
export const user = {
  me: () => request("/user/me"),
  updatePlan: (plan_id: string) =>
    request("/user/plan", { method: "PUT", body: JSON.stringify({ plan_id }) }),
  updateSettings: (notification_settings: Record<string, boolean>) =>
    request("/user/settings", { method: "PUT", body: JSON.stringify({ notification_settings }) }),
};

// ── GitHub ────────────────────────────────────────────────────
export const github = {
  repos: (page = 1) => request(`/github/repos?page=${page}`),
  sync: () => request("/github/sync", { method: "POST" }),
  tree: (owner: string, repo: string, sha?: string) =>
    request(`/github/repos/${owner}/${repo}/tree${sha ? `?sha=${sha}` : ""}`),
  file: (owner: string, repo: string, path: string) =>
    request(`/github/repos/${owner}/${repo}/file?path=${encodeURIComponent(path)}`),
  branches: (owner: string, repo: string) =>
    request(`/github/repos/${owner}/${repo}/branches`),
  workflows: (owner: string, repo: string) =>
    request(`/github/repos/${owner}/${repo}/workflows`),
  createPR: (owner: string, repo: string, data: { title: string; head: string; base: string; body?: string }) =>
    request(`/github/repos/${owner}/${repo}/pr`, { method: "POST", body: JSON.stringify(data) }),
};

// ── Projects (real project creation: github clone / folder upload / templates) ──
export const projects = {
  list: () => request("/projects"),
  create: (data: { name: string; source?: string; repo_full_name?: string; branch?: string; files?: { path: string; content: string }[] }) =>
    request("/projects", { method: "POST", body: JSON.stringify(data) }),
};

// ── Threads ───────────────────────────────────────────────────
export const threads = {
  list: () => request("/threads"),
  get: (id: string) => request(`/threads/${id}`),
  create: (data: { project_id?: string; title?: string; mode?: string; model_id?: string }) =>
    request("/threads", { method: "POST", body: JSON.stringify(data) }),
  send: (id: string, message: string) =>
    request(`/threads/${id}/send`, { method: "POST", body: JSON.stringify({ message }) }),
  continueRun: (id: string) => request(`/threads/${id}/continue`, { method: "POST" }),
  inlineEdit: (id: string, data: { path: string; content: string; instruction: string; selection?: { startLine?: number; endLine?: number; text?: string } }) =>
    request(`/threads/${id}/inline-edit`, { method: "POST", body: JSON.stringify(data) }),
  parallel: (id: string, data: { goal: string; breakdown: { name: string; task: string }[] }) =>
    request(`/threads/${id}/parallel`, { method: "POST", body: JSON.stringify(data) }),
  resolvePermission: (id: string, requestId: string, approved: boolean) =>
    request(`/threads/${id}/permissions/${requestId}/resolve`, { method: "POST", body: JSON.stringify({ approved }) }),
  stop: (id: string) => request(`/threads/${id}/stop`, { method: "POST" }),
  commit: (id: string) => request(`/threads/${id}/commit`, { method: "POST" }),
  setMode: (id: string, mode: string) =>
    request(`/threads/${id}/mode`, { method: "POST", body: JSON.stringify({ mode }) }),
  setModel: (id: string, model_id: string) =>
    request(`/threads/${id}/model`, { method: "POST", body: JSON.stringify({ model_id }) }),
  delete: (id: string) => request(`/threads/${id}`, { method: "DELETE" }),
};

// ── Sandboxes ─────────────────────────────────────────────────
export const sandboxes = {
  list: () => request("/sandboxes"),
  create: (label?: string) =>
    request("/sandboxes", { method: "POST", body: JSON.stringify({ label }) }),
  exec: (id: string, command: string, cwd?: string) =>
    request(`/sandboxes/${id}/exec`, { method: "POST", body: JSON.stringify({ command, cwd }) }),
  start: (id: string) => request(`/sandboxes/${id}/start`, { method: "POST" }),
  stop: (id: string) => request(`/sandboxes/${id}/stop`, { method: "POST" }),
  delete: (id: string) => request(`/sandboxes/${id}`, { method: "DELETE" }),
  connect: (id: string, kind: "ssh" | "desktop") =>
    request(`/sandboxes/${id}/connect`, { method: "POST", body: JSON.stringify({ kind }) }),
};

// ── Workflows ─────────────────────────────────────────────────
export const workflows = {
  list: () => request("/workflows"),
  get: (id: string) => request(`/workflows/${id}`),
  create: (data: { name: string; slug: string; template: string; region: string; plan: string }) =>
    request("/workflows", { method: "POST", body: JSON.stringify(data) }),
  executions: (id: string) => request(`/workflows/${id}/executions`),
  pause: (id: string) => request(`/workflows/${id}/pause`, { method: "POST" }),
  resume: (id: string) => request(`/workflows/${id}/resume`, { method: "POST" }),
  delete: (id: string) => request(`/workflows/${id}`, { method: "DELETE" }),
};

// ── Automations ───────────────────────────────────────────────
export const automations = {
  list: () => request("/automations"),
  create: (data: { name: string; goal: string; trigger_config: string; project_id: string; prompt: string; model_id: string }) =>
    request("/automations", { method: "POST", body: JSON.stringify(data) }),
  run: (id: string) => request(`/automations/${id}/run`, { method: "POST" }),
  delete: (id: string) => request(`/automations/${id}`, { method: "DELETE" }),
};

// ── Subagents ─────────────────────────────────────────────────
export const subagents = {
  list: () => request("/subagents"),
  create: (data: { name: string; description?: string; icon?: string; color?: string; scope?: string; tools?: string[]; system_prompt?: string }) =>
    request("/subagents", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request(`/subagents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => request(`/subagents/${id}`, { method: "DELETE" }),
};

// ── MCP ───────────────────────────────────────────────────────
export const mcp = {
  list: () => request("/mcp"),
  install: (config: { name: string; transport: string; command?: string; url?: string; package?: string }) =>
    request("/mcp", { method: "POST", body: JSON.stringify(config) }),
  tools: (id: string) => request(`/mcp/${id}/tools`),
  call: (serverId: string, tool_name: string, args: any) =>
    request(`/mcp/${serverId}/call`, { method: "POST", body: JSON.stringify({ tool_name, args }) }),
  toggle: (id: string, enabled: boolean) =>
    request(`/mcp/${id}/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }),
  remove: (id: string) => request(`/mcp/${id}`, { method: "DELETE" }),
};

// ── SMTP ──────────────────────────────────────────────────────
export const smtp = {
  get: () => request("/smtp"),
  generate: () => request("/smtp/generate", { method: "POST" }),
  send: (data: { to: string; subject: string; body: string; html?: string }) =>
    request("/smtp/send", { method: "POST", body: JSON.stringify(data) }),
  revoke: () => request("/smtp", { method: "DELETE" }),
};

// ── Updates ────────────────────────────────────────────────────
export const updates = {
  check: () => request("/updates/check", { method: "POST" }),
};

// ── Deployments ───────────────────────────────────────────────
export const deployments = {
  list: () => request("/deployments"),
  create: (data: { project_id: string; thread_id: string; port?: number }) =>
    request("/deployments", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request(`/deployments/${id}`, { method: "DELETE" }),
};

// ── Notifications ─────────────────────────────────────────────
export const notifications = {
  list: () => request("/notifications"),
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request("/notifications/read-all", { method: "POST" }),
};

// ── Billing ───────────────────────────────────────────────────
export const billing = {
  usage: () => request("/billing/usage"),
  plan: () => request("/billing/plan"),
  plans: () => request("/billing/plans"),
  updatePlan: (plan_id: string) =>
    request("/billing/plan", { method: "PUT", body: JSON.stringify({ plan_id }) }),
  topup: (amount: number) =>
    request("/billing/topup", { method: "POST", body: JSON.stringify({ amount }) }),
};

// ── Models (OpenAI-compatible) ────────────────────────────────
export const models = {
  list: () => fetch(`${API_BASE.replace("/api", "")}/v1/models`).then((r) => r.json()),
};
// ── WebSocket ─────────────────────────────────────────────────
export function createWebSocket(): WebSocket | null {
  const token = getToken();
  if (!token) return null;
  try {
    return new WebSocket(`${WS_BASE}?token=${token}`);
  } catch { return null; }
}

// ── Devices ─────────────────────────────────────────────────
export const devices = {
  pair: () => request("/devices/pair", { method: "POST" }),
  pairStatus: (pairing_token: string) => request(`/devices/pair/${pairing_token}/status`),
  verify: (pairing_token: string) =>
    request("/devices/verify", { method: "POST", body: JSON.stringify({ pairing_token }) }),
  list: () => request("/devices"),
  disconnect: (id: string) => request(`/devices/${id}`, { method: "DELETE" }),
};

// ── n8n / Workflow Templates ────────────────────────────────
export const n8n = {
  get: () => request("/n8n"),
  start: () => request("/n8n/start", { method: "POST" }),
  stop: () => request("/n8n/stop", { method: "POST" }),
  injectTemplate: (templateId: string) => request(`/n8n/templates/${templateId}/inject`, { method: "POST" }),
  workflows: () => request("/n8n/workflows"),
};

// ── Remote Nodes (admin only) ───────────────────────────────
export const nodes = {
  list: () => request("/nodes"),
  create: (data: { name: string; region?: string; role?: string; storage_gb?: number }) =>
    request("/nodes", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => request(`/nodes/${id}`, { method: "DELETE" }),
  exec: (id: string, command: string, cwd?: string) =>
    request(`/nodes/${id}/exec`, { method: "POST", body: JSON.stringify({ command, cwd }) }),
  stats: (id: string) => request(`/nodes/${id}/stats`),
  sandboxes: (id: string) => request(`/nodes/${id}/sandboxes`),
  updateConfig: (id: string, config: Record<string, unknown>) =>
    request(`/nodes/${id}/config`, { method: "PATCH", body: JSON.stringify(config) }),
};

export const workflowTemplates = {
  list: () => request("/workflow-templates"),
};

// ── Notifications Sound ───────────────────────────────────────
export function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// ── Request desktop notification permission ───────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showDesktopNotification(title: string, body?: string, onClick?: () => void) {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/favicon.ico", tag: "kiren" });
  if (onClick) n.onclick = () => { window.focus(); onClick(); };
}
