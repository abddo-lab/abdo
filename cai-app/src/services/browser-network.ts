/**
 * Browser Network — peer-to-peer browser sharing
 * Users with extensions can lend their browser to others
 * Earns $0.01 per task performed
 */

import { settingsDB } from "./db";


// ─── Types ───
export interface BrowserPeer {
  id: string;
  userId: string;
  wsUrl: string;
  status: "online" | "busy" | "offline";
  capabilities: string[];
  tasksCompleted: number;
  totalEarned: number;
  lastSeen: number;
  userAgent: string;
  browserName: string;
}

export interface BrowserTask {
  id: string;
  requesterId: string;
  providerId: string;
  task: string;
  status: "pending" | "assigned" | "running" | "completed" | "failed";
  steps: Array<{ action: string; result: string; screenshot?: string }>;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  cost: number;
  earnings: number;
}

export interface ExtensionStatus {
  installed: boolean;
  version?: string;
  connected: boolean;
  peerId?: string;
}

// ─── Extension Detection ───
let extensionDetected = false;
let extensionVersion: string | null = null;
let detectionHandlers: Array<(status: ExtensionStatus) => void> = [];

export function onExtensionStatus(handler: (status: ExtensionStatus) => void): () => void {
  detectionHandlers.push(handler);
  return () => { detectionHandlers = detectionHandlers.filter((h) => h !== handler); };
}

function emitExtensionStatus(status: ExtensionStatus) {
  detectionHandlers.forEach((h) => h(status));
}

// Detect if extension is installed
export async function detectExtension(): Promise<ExtensionStatus> {
  return new Promise((resolve) => {
    // Method 1: Check for extension's injected element
    const checkElement = () => {
      const el = document.getElementById("__cai_extension_loaded__");
      if (el) {
        extensionDetected = true;
        extensionVersion = el.getAttribute("data-version") ?? "1.0.0";
        const status: ExtensionStatus = { installed: true, version: extensionVersion ?? undefined, connected: false };
        emitExtensionStatus(status);
        resolve(status);
        return true;
      }
      return false;
    };

    if (checkElement()) return;

    // Method 2: Try to send message to extension
    const timeout = setTimeout(() => {
      // Method 3: Check via custom event
      window.postMessage({ type: "__cai_detect__" }, "*");
      setTimeout(() => {
        if (!extensionDetected) {
          const status: ExtensionStatus = { installed: false, connected: false };
          emitExtensionStatus(status);
          resolve(status);
        }
      }, 500);
    }, 1000);

    // Listen for extension response
    const listener = (event: MessageEvent) => {
      if (event.data?.type === "__cai_extension_pong__") {
        extensionDetected = true;
        extensionVersion = event.data.version;
        clearTimeout(timeout);
        window.removeEventListener("message", listener);
        const status: ExtensionStatus = { installed: true, version: extensionVersion ?? undefined, connected: true };
        emitExtensionStatus(status);
        resolve(status);
      }
    };
    window.addEventListener("message", listener);

    // Immediate check
    checkElement();
  });
}

export function isExtensionInstalled(): boolean {
  return extensionDetected;
}

export function getExtensionVersion(): string | null {
  return extensionVersion;
}

// ─── Peer Registry ───
let peers: BrowserPeer[] = [];
let peerHandlers: Array<(peers: BrowserPeer[]) => void> = [];

export function onPeersChange(handler: (peers: BrowserPeer[]) => void): () => void {
  peerHandlers.push(handler);
  return () => { peerHandlers = peerHandlers.filter((h) => h !== handler); };
}

function emitPeers() {
  peerHandlers.forEach((h) => h(peers));
}

export async function registerAsPeer(userId: string): Promise<BrowserPeer> {
  const peer: BrowserPeer = {
    id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    wsUrl: `ws://localhost:9222`,
    status: "online",
    capabilities: ["navigate", "click", "type", "screenshot", "extract"],
    tasksCompleted: 0,
    totalEarned: 0,
    lastSeen: Date.now(),
    userAgent: navigator.userAgent,
    browserName: detectBrowserName(),
  };

  peers.push(peer);
  emitPeers();

  // Save to DB
  const saved = await settingsDB.get<BrowserPeer[]>("browser_peers", []);
  saved.push(peer);
  await settingsDB.set("browser_peers", saved);

  return peer;
}

export async function unregisterPeer(peerId: string): Promise<void> {
  peers = peers.filter((p) => p.id !== peerId);
  emitPeers();
  const saved = await settingsDB.get<BrowserPeer[]>("browser_peers", []);
  await settingsDB.set("browser_peers", saved.filter((p) => p.id !== peerId));
}

export function getAvailablePeers(): BrowserPeer[] {
  return peers.filter((p) => p.status === "online");
}

export function getAllPeers(): BrowserPeer[] {
  return [...peers];
}

// ─── Task Routing ───
export async function routeTask(task: string, requesterId: string): Promise<{ peer: BrowserPeer; taskId: string } | null> {
  // Check if local extension is available
  if (extensionDetected) {
    // Use local extension
    const localPeer = peers.find((p) => p.userId === requesterId && p.status === "online");
    if (localPeer) {
      const taskId = await createTask(requesterId, localPeer.id, task);
      return { peer: localPeer, taskId };
    }
  }

  // Find available peer
  const available = getAvailablePeers();
  if (available.length === 0) return null;

  // Pick peer with most completed tasks (load balancing)
  const bestPeer = available.sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0];
  const taskId = await createTask(requesterId, bestPeer.id, task);

  return { peer: bestPeer, taskId };
}

async function createTask(requesterId: string, providerId: string, task: string): Promise<string> {
  const browserTask: BrowserTask = {
    id: `btask-${Date.now()}`,
    requesterId,
    providerId,
    task,
    status: "pending",
    steps: [],
    createdAt: Date.now(),
    cost: 0.01,
    earnings: 0.01,
  };

  const tasks = await settingsDB.get<BrowserTask[]>("browser_tasks", []);
  tasks.push(browserTask);
  await settingsDB.set("browser_tasks", tasks);

  return browserTask.id;
}

export async function updateTaskStatus(taskId: string, status: BrowserTask["status"], step?: { action: string; result: string }): Promise<void> {
  const tasks = await settingsDB.get<BrowserTask[]>("browser_tasks", []);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.status = status;
  if (step) task.steps.push(step);
  if (status === "running" && !task.startedAt) task.startedAt = Date.now();
  if (status === "completed" || status === "failed") {
    task.finishedAt = Date.now();
    // Credit the provider
    if (status === "completed") {
      await creditProvider(task.providerId, task.earnings);
    }
  }

  await settingsDB.set("browser_tasks", tasks);
}

async function creditProvider(providerId: string, amount: number): Promise<void> {
  const peer = peers.find((p) => p.id === providerId);
  if (peer) {
    peer.tasksCompleted++;
    peer.totalEarned += amount;
    emitPeers();
  }

  // Also credit the user account
  const accounts = await settingsDB.get<Array<{ id: string; email: string; browserEarnings: number }>>("user_accounts", []);
  const account = accounts.find((a) => a.id === providerId || a.email === providerId);
  if (account) {
    account.browserEarnings = (account.browserEarnings ?? 0) + amount;
    await settingsDB.set("user_accounts", accounts);
  }
}

export async function getTaskHistory(userId: string): Promise<BrowserTask[]> {
  const tasks = await settingsDB.get<BrowserTask[]>("browser_tasks", []);
  return tasks.filter((t) => t.requesterId === userId || t.providerId === userId);
}

export async function getEarnings(userId: string): Promise<{ tasks: number; earned: number; spent: number }> {
  const tasks = await settingsDB.get<BrowserTask[]>("browser_tasks", []);
  const provided = tasks.filter((t) => t.providerId === userId && t.status === "completed");
  const requested = tasks.filter((t) => t.requesterId === userId && t.status === "completed");
  return {
    tasks: provided.length,
    earned: provided.reduce((s, t) => s + t.earnings, 0),
    spent: requested.reduce((s, t) => s + t.cost, 0),
  };
}

// ─── Browser Detection ───
function detectBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Brave")) return "Brave";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
}

// ─── WebSocket Connection ───
let ws: WebSocket | null = null;

export function connectToNetwork(wsUrl = "ws://localhost:9223"): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Register this peer
        ws!.send(JSON.stringify({
          type: "register",
          capabilities: ["navigate", "click", "type", "screenshot", "extract", "evaluate"],
          userAgent: navigator.userAgent,
        }));
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleNetworkMessage(msg);
        } catch {}
      };

      ws.onclose = () => {
        ws = null;
      };

      ws.onerror = () => {
        reject(new Error("Failed to connect to browser network"));
      };
    } catch (err) {
      reject(err);
    }
  });
}

function handleNetworkMessage(msg: any) {
  switch (msg.type) {
    case "task_assigned":
      // Execute task in local browser
      executeNetworkTask(msg.task);
      break;
    case "peer_update":
      // Update peer list
      if (msg.peers) {
        peers = msg.peers;
        emitPeers();
      }
      break;
  }
}

async function executeNetworkTask(task: BrowserTask) {
  // This would use the local extension to execute the task
  // For now, just update status
  await updateTaskStatus(task.id, "running");
  // ... execute actions via extension ...
  await updateTaskStatus(task.id, "completed", { action: "Task completed", result: "Success" });
}
