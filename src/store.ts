// src/store.ts — Real data store, replaces all seed data with API calls
import { useState, useEffect, useCallback, useRef } from "react";
import * as api from "./api";

// ── Models (real list from the model API via /v1/models) ────────
export function useModels(enabled = true) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.models.list();
      setModels((data.data || []).filter((m: any) => m.id));
    } catch { setModels([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { models, loading, refresh };
}

// ── Projects (GitHub repos + real projects created on the server) ──
export function useProjects(enabled = true) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Run both in parallel but don't let GitHub failure wipe real projects
      const [ghResult, realResult] = await Promise.allSettled([
        api.github.repos(),
        api.projects.list(),
      ]);

      const ghRepos = ghResult.status === "fulfilled" ? (ghResult.value.repos || []) : [];
      const realProjects = realResult.status === "fulfilled" ? (realResult.value.projects || []) : [];

      const mapped = [
        ...ghRepos.map((r: any) => ({
          id: `gh-${r.id}`,
          name: r.name,
          category: r.private ? "Private" : "Public",
          source: "github",
          repo: r.full_name,
          branch: r.default_branch || "main",
          stack: r.language ? [r.language] : [],
          glyph: r.name.slice(0, 2).toUpperCase(),
          color: r.private ? "#3d3d52" : "#1A1D28",
          updated: r.updated_at,
          threads: [],
          files: [],
          code: [],
          preview: [],
          domain: r.name,
        })),
        ...realProjects.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.source === "github" ? "Private" : p.source === "template" ? "Template" : "Local",
          source: p.source,
          repo: p.repo_full_name,
          branch: p.branch || "main",
          stack: (p.stack || []).length ? p.stack : ["TypeScript"],
          glyph: p.glyph || p.name.slice(0, 2).toUpperCase(),
          color: p.color || "#3d3d52",
          updated: p.updated_at,
          status: p.status || "ready",
          threads: [],
          files: [],
          code: [],
          preview: [],
          domain: p.name,
        })),
      ];
      setProjects(mapped);
    } catch {
      setProjects([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { projects, setProjects, loading, refresh };
}

// ── Threads ──────────────────────────────────────────────────
export function useThreads(enabled = true) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const data = await api.threads.list();
      setThreads(data.threads || []);
    } catch { setThreads([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { threads, setThreads, loading, refresh };
}

// ── Billing ──────────────────────────────────────────────────
export function useBilling(enabled = true) {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.billing.usage();
      setBilling(data);
    } catch { setBilling(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { billing, loading, refresh };
}

// ── Notifications ────────────────────────────────────────────
export function useNotifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api.notifications.list();
      setNotifs(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {}
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { notifs, unread, refresh };
}

// ── Subagents ────────────────────────────────────────────────
export function useSubagents() {
  const [subagents, setSubagents] = useState<any[]>([]);
  const refresh = useCallback(async () => {
    try {
      const data = await api.subagents.list();
      setSubagents(data.subagents || []);
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { subagents, refresh };
}

// ── Sandbox (single per user, created at plan purchase) ───────
export function useSandbox(enabled = true) {
  const [sandbox, setSandbox] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.sandboxes.list();
      setSandbox(data.sandboxes?.[0] || null);
    } catch { setSandbox(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { sandbox, loading, refresh };
}

// ── Workflows ────────────────────────────────────────────────
export function useWorkflows(enabled = true) {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.workflows.list();
      setInstances(data.instances || []);
    } catch { setInstances([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { instances, setInstances, loading, refresh };
}

// ── Automations ──────────────────────────────────────────────
export function useAutomations(enabled = true) {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.automations.list();
      setAutomations(data.automations || []);
    } catch { setAutomations([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    refresh();
  }, [enabled, refresh]);
  return { automations, setAutomations, loading, refresh };
}

// ── MCP Servers ──────────────────────────────────────────────
export function useMCP() {
  const [servers, setServers] = useState<any[]>([]);
  const refresh = useCallback(async () => {
    try {
      const data = await api.mcp.list();
      setServers(data.servers || []);
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { servers, refresh };
}

// ── Deployments ──────────────────────────────────────────────
export function useDeployments() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const refresh = useCallback(async () => {
    try {
      const data = await api.deployments.list();
      setDeployments(data.deployments || []);
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { deployments, refresh };
}

// ── WebSocket hook ───────────────────────────────────────────
export function useWebSocket(enabled: boolean, onMessage?: (msg: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = api.createWebSocket();
      if (!ws || disposed) return;
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try { onMessageRef.current?.(JSON.parse(e.data)); } catch {}
      };
      ws.onclose = () => {
        if (disposed) return;
        wsRef.current = null;
        timer = setTimeout(connect, 3000);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [enabled]);

  return wsRef;
}
