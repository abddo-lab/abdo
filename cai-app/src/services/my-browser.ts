/**
 * My Browser MCP — browser automation via extension
 * Connects to user's browser via WebSocket, uses Gemini 2.5 Flash for vision
 */

import { getConfig } from "./config";
import { settingsDB } from "./db";

// ─── Types ───
export interface BrowserTab {
  id: number;
  url: string;
  title: string;
  active: boolean;
  windowId: number;
}

export interface BrowserAction {
  type: "navigate" | "click" | "type" | "scroll" | "screenshot" | "wait" | "select" | "hover" | "press" | "extract" | "evaluate";
  selector?: string;
  value?: string;
  url?: string;
  key?: string;
  script?: string;
  x?: number;
  y?: number;
}

export interface BrowserActionResult {
  success: boolean;
  screenshot?: string; // base64
  data?: unknown;
  error?: string;
  tab?: BrowserTab;
}

export interface BrowserSession {
  id: string;
  status: "connecting" | "connected" | "disconnected" | "executing";
  tabs: BrowserTab[];
  activeTabId: number | null;
  wsUrl: string;
  createdAt: number;
  lastActionAt: number;
  actionsExecuted: number;
}

export interface VisionAnalysis {
  description: string;
  elements: Array<{
    type: string;
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    clickable: boolean;
    interactable: boolean;
  }>;
  suggestions: string[];
  confidence: number;
}

export interface TrainingOptIn {
  enabled: boolean;
  requestsCount: number;
  totalEarned: number;
  lastRequestAt: number;
}

// ─── WebSocket Connection ───
let ws: WebSocket | null = null;
let session: BrowserSession | null = null;
let messageHandlers: Map<string, (data: unknown) => void> = new Map();
let statusHandlers: Array<(status: string) => void> = [];

export function onBrowserStatus(handler: (status: string) => void): () => void {
  statusHandlers.push(handler);
  return () => { statusHandlers = statusHandlers.filter((h) => h !== handler); };
}

function emitStatus(status: string) {
  statusHandlers.forEach((h) => h(status));
}

export function connectBrowser(wsUrl = "ws://localhost:9222"): Promise<BrowserSession> {
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        session = {
          id: `browser-${Date.now()}`,
          status: "connected",
          tabs: [],
          activeTabId: null,
          wsUrl,
          createdAt: Date.now(),
          lastActionAt: Date.now(),
          actionsExecuted: 0,
        };
        emitStatus("connected");
        // Request tab list
        ws!.send(JSON.stringify({ type: "getTabs" }));
        resolve(session);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handler = messageHandlers.get(data.id);
          if (handler) {
            handler(data);
            messageHandlers.delete(data.id);
          }
          // Update tabs if provided
          if (data.tabs && session) {
            session.tabs = data.tabs;
            session.activeTabId = data.tabs.find((t: BrowserTab) => t.active)?.id ?? null;
          }
        } catch {}
      };

      ws.onclose = () => {
        if (session) session.status = "disconnected";
        emitStatus("disconnected");
        ws = null;
      };

      ws.onerror = () => {
        emitStatus("error");
        reject(new Error("Failed to connect to browser extension. Make sure the extension is installed and the WebSocket server is running."));
      };
    } catch (err) {
      reject(err);
    }
  });
}

export function disconnectBrowser(): void {
  ws?.close();
  ws = null;
  session = null;
  emitStatus("disconnected");
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function getSession(): BrowserSession | null {
  return session;
}

// ─── Send Action to Extension ───
function sendAction(action: BrowserAction): Promise<BrowserActionResult> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Browser not connected"));
      return;
    }

    const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    messageHandlers.set(id, (data: any) => {
      if (data.error) {
        resolve({ success: false, error: data.error });
      } else {
        resolve({ success: true, screenshot: data.screenshot, data: data.data, tab: data.tab });
      }
    });

    if (session) {
      session.status = "executing";
      session.lastActionAt = Date.now();
      session.actionsExecuted++;
    }

    ws.send(JSON.stringify({ id, ...action }));

    // Timeout after 30s
    setTimeout(() => {
      if (messageHandlers.has(id)) {
        messageHandlers.delete(id);
        resolve({ success: false, error: "Action timed out" });
      }
    }, 30000);
  });
}

// ─── Browser Actions ───
export async function navigate(url: string): Promise<BrowserActionResult> {
  return sendAction({ type: "navigate", url });
}

export async function click(selector: string): Promise<BrowserActionResult> {
  return sendAction({ type: "click", selector });
}

export async function type(selector: string, text: string): Promise<BrowserActionResult> {
  return sendAction({ type: "type", selector, value: text });
}

export async function scroll(direction: "up" | "down", amount?: number): Promise<BrowserActionResult> {
  return sendAction({ type: "scroll", value: direction, y: amount ?? 300 });
}

export async function screenshot(): Promise<BrowserActionResult> {
  return sendAction({ type: "screenshot" });
}

export async function wait(ms: number): Promise<BrowserActionResult> {
  return new Promise((resolve) => setTimeout(() => resolve({ success: true }), ms));
}

export async function select(selector: string, value: string): Promise<BrowserActionResult> {
  return sendAction({ type: "select", selector, value });
}

export async function hover(selector: string): Promise<BrowserActionResult> {
  return sendAction({ type: "hover", selector });
}

export async function press(key: string): Promise<BrowserActionResult> {
  return sendAction({ type: "press", key });
}

export async function extract(selector: string): Promise<BrowserActionResult> {
  return sendAction({ type: "extract", selector });
}

export async function evaluate(script: string): Promise<BrowserActionResult> {
  return sendAction({ type: "evaluate", script });
}

export async function getTabs(): Promise<BrowserTab[]> {
  if (!session) return [];
  await sendAction({ type: "evaluate", script: "document.title" });
  return session.tabs;
}

export async function switchTab(tabId: number): Promise<BrowserActionResult> {
  return sendAction({ type: "evaluate", script: `window.switchToTab(${tabId})` });
}

// ─── Gemini Vision Analysis ───
async function analyzeScreenshot(base64: string, task: string): Promise<VisionAnalysis> {
  const config = getConfig();
  const geminiKey = (config as any).gemini?.apiKey;
  if (!geminiKey) {
    return { description: "Gemini API key not configured", elements: [], suggestions: [], confidence: 0 };
  }

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are a browser automation assistant. Analyze this screenshot and identify interactive elements.

Task: ${task}

Respond in JSON format:
{
  "description": "what you see on the page",
  "elements": [
    {"type": "button|link|input|text|image|menu", "text": "visible text", "bounds": {"x": 0, "y": 0, "width": 100, "height": 50}, "clickable": true, "interactable": true}
  ],
  "suggestions": ["next action to take"],
  "confidence": 0.9
}`
            },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!resp.ok) throw new Error(`Gemini error ${resp.status}`);
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);

    return { description: text, elements: [], suggestions: [], confidence: 0.5 };
  } catch (err) {
    return { description: `Vision error: ${err}`, elements: [], suggestions: [], confidence: 0 };
  }
}

// ─── Autonomous Browser Agent ───
export interface BrowserAgentTask {
  id: string;
  task: string;
  status: "running" | "completed" | "failed";
  steps: Array<{ action: string; result: string; screenshot?: string }>;
  startedAt: number;
  finishedAt?: number;
}

export async function runBrowserTask(task: string): Promise<BrowserAgentTask> {
  const agentTask: BrowserAgentTask = {
    id: `bt-${Date.now()}`,
    task,
    status: "running",
    steps: [],
    startedAt: Date.now(),
  };

  try {
    // Step 1: Take initial screenshot
    const ss = await screenshot();
    if (!ss.success || !ss.screenshot) throw new Error("Failed to take screenshot");

    agentTask.steps.push({ action: "Initial screenshot", result: "Captured", screenshot: ss.screenshot });

    // Step 2: Analyze with Gemini
    const analysis = await analyzeScreenshot(ss.screenshot, task);
    agentTask.steps.push({ action: "Vision analysis", result: analysis.description });

    // Step 3: Execute suggested actions
    for (const suggestion of analysis.suggestions.slice(0, 5)) {
      // Parse suggestion into action
      if (suggestion.includes("click")) {
        const element = analysis.elements.find((e) => e.clickable && suggestion.toLowerCase().includes(e.text.toLowerCase()));
        if (element) {
          const result = await click(`[data-testid="${element.text}"]`);
          agentTask.steps.push({ action: `Click: ${element.text}`, result: result.success ? "Done" : result.error ?? "Failed" });
        }
      } else if (suggestion.includes("type") || suggestion.includes("enter")) {
        const input = analysis.elements.find((e) => e.interactable && e.type === "input");
        if (input) {
          const result = await type(`input[placeholder*="${input.text}"]`, task);
          agentTask.steps.push({ action: `Type in: ${input.text}`, result: result.success ? "Done" : result.error ?? "Failed" });
        }
      } else if (suggestion.includes("navigate") || suggestion.includes("go to")) {
        const urlMatch = suggestion.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          const result = await navigate(urlMatch[0]);
          agentTask.steps.push({ action: `Navigate: ${urlMatch[0]}`, result: result.success ? "Done" : result.error ?? "Failed" });
        }
      }

      await wait(500);
    }

    agentTask.status = "completed";
    agentTask.finishedAt = Date.now();
  } catch (err) {
    agentTask.status = "failed";
    agentTask.finishedAt = Date.now();
    agentTask.steps.push({ action: "Error", result: err instanceof Error ? err.message : String(err) });
  }

  return agentTask;
}

// ─── Training Opt-In ───
export async function getTrainingOptIn(userId: string): Promise<TrainingOptIn> {
  const opts = await settingsDB.get<Record<string, TrainingOptIn>>("training_optins", {});
  return opts[userId] ?? { enabled: false, requestsCount: 0, totalEarned: 0, lastRequestAt: 0 };
}

export async function setTrainingOptIn(userId: string, enabled: boolean): Promise<void> {
  const opts = await settingsDB.get<Record<string, TrainingOptIn>>("training_optins", {});
  if (!opts[userId]) opts[userId] = { enabled: false, requestsCount: 0, totalEarned: 0, lastRequestAt: 0 };
  opts[userId].enabled = enabled;
  await settingsDB.set("training_optins", opts);
}

export async function recordTrainingRequest(userId: string): Promise<number> {
  const opts = await settingsDB.get<Record<string, TrainingOptIn>>("training_optins", {});
  if (!opts[userId] || !opts[userId].enabled) return 0;

  opts[userId].requestsCount++;
  opts[userId].totalEarned += 0.01;
  opts[userId].lastRequestAt = Date.now();
  await settingsDB.set("training_optins", opts);

  return 0.01; // $0.01 earned
}

export async function getTrainingEarnings(userId: string): Promise<{ requests: number; earned: number }> {
  const opts = await settingsDB.get<Record<string, TrainingOptIn>>("training_optins", {});
  const o = opts[userId];
  return { requests: o?.requestsCount ?? 0, earned: o?.totalEarned ?? 0 };
}
