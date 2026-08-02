// src/App.tsx — Main app, wired to real backend APIs
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cn } from "./utils/cn";
import { Icon } from "./icons";
import Sidebar, { type View } from "./components/Sidebar";
import MyWork from "./components/MyWork";
import AgentView from "./components/AgentView";
import RightPanel, { type PanelTab } from "./components/RightPanel";
import Workflows from "./components/Workflows";
import AutomationsView from "./components/AutomationsView";
import Settings from "./components/Settings";
import CommandPalette from "./components/CommandPalette";
import LoginScreen from "./components/LoginScreen";
import PricingScreen from "./components/PricingScreen";
import ProjectPicker from "./components/ProjectPicker";
import { IconBtn } from "./components/ui";
import {
  type CommandItem,
  type Project,
  type WorkItem,
} from "./data";
import * as api from "./api";
import { useProjects, useThreads, useBilling, useWebSocket, useWorkflows, useAutomations, useSandbox, useModels } from "./store";

interface Toast { id: number; msg: string }
type AuthStage = "loading" | "login" | "pricing" | "app";

/** Starter project scaffolded on a new user's first login so the editor isn't empty */
const STARTER_TEMPLATE: { path: string; content: string }[] = [
  { path: "package.json", content: JSON.stringify({ name: "my-first-app", private: true, version: "0.1.0", type: "module", scripts: { dev: "vite", build: "vite build", preview: "vite preview" }, dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { "@vitejs/plugin-react": "^4.3.1", typescript: "^5.5.0", vite: "^5.4.0" } }, null, 2) },
  { path: "index.html", content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>My First App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>` },
  { path: "src/main.tsx", content: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
` },
  { path: "src/App.tsx", content: `export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1>Welcome to Kiren 👋</h1>
      <p>This starter app is ready to edit. Use Cmd+K to inline-edit any file, or type a goal in the chat and let the agent build it.</p>
    </main>
  );
}
` },
  { path: "src/index.css", content: `:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, sans-serif; color: #222; background: #fafafa; }
` },
  { path: "README.md", content: "# My First App\n\nScaffolded from Kiren's template library.\n\n```bash\nnpm install\nnpm run dev\n```\n" },
];

/** Convert server thread_blocks ({kind, data}) into the frontend Block shape */
function mapServerBlocks(raw: any[]): any[] {
  return (raw || [])
    .map((b: any) => {
      const data = b.data && typeof b.data === "string" ? JSON.parse(b.data) : (b.data || {});
      switch (b.kind) {
        case "user": return { k: "user", text: data.text || "", attach: data.attach };
        case "thinking": return { k: "thinking", text: data.text || "", ms: data.ms || 0, confidence: data.confidence, plan: data.plan };
        case "todo": return { k: "todo", items: data.items || [] };
        case "tool": return {
          k: "tool", tool: data.tool || "", icon: data.icon || "wrench",
          target: data.target || "", meta: data.meta, output: data.output,
          status: data.status || "done",
        };
        case "terminal": return { k: "terminal", cmd: data.cmd || "", lines: data.lines || [], exit: data.exit ?? 0 };
        case "permission": return {
          k: "permission", tool: data.tool || "", detail: data.detail || "", resolved: data.resolved,
          requestId: data.request_id || "", mcpInstall: data.mcp_install || null,
        };
        case "memory_success":
        case "memory_attempt":
        case "memory_insight":
        case "memory_failure":
        case "memory_successes":
          return { k: "memory", text: data.text || data.learned || "" };
        case "preview": return { k: "preview", label: data.label || "Open preview" };
        case "summary": return { k: "summary", title: data.title || "Summary", bullets: data.bullets || [] };
        case "text": return { k: "text", text: data.text || "" };
        case "diff": return { k: "diff", fileIds: data.fileIds || [] };
        default: return null;
      }
    })
    .filter(Boolean);
}

export default function App() {
  const [compact] = useState(false);
  const [view, setView] = useState<View>("agent");
  const [projectId, setProjectId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [tab, setTab] = useState<PanelTab>("preview");
  const [showPanel, setShowPanel] = useState(true);
  const [showSide, setShowSide] = useState(true);
  const [working, setWorking] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [threadBlocks, setThreadBlocks] = useState<Record<string, any[]>>({});
  const [mode, setMode] = useState<"agent" | "plan" | "ask">("agent");
  const [model, setModel] = useState("");
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);

  // Auth state
  const [authStage, setAuthStage] = useState<AuthStage>("loading");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authPlan, setAuthPlan] = useState<any>(null);

  // Only fetch data once authenticated (avoid 401 floods on the login screen)
  const authed = authStage === "app" && !!authToken;
  const { models: realModels } = useModels(authed);
  const { projects, refresh: refreshProjects, loading: projectsLoading } = useProjects(authed);
  const { threads: apiThreads, refresh: refreshThreads } = useThreads(authed);
  const { billing, refresh: refreshBilling } = useBilling(authed);
  useWorkflows(authed);
  useAutomations(authed);
  const { sandbox, refresh: refreshSandbox } = useSandbox(authed);

  // Build project objects with threads attached
  const projectsWithThreads: Project[] = projects.map((p) => ({
    ...p,
    threads: apiThreads.filter((t: any) => t.project_id === p.id).map((t: any) => ({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      status: t.status,
      updated: t.updated_at,
      model: t.model_id,
      branch: t.branch || `${p.name}/thread-${t.id.slice(-4)}`,
      tokens: t.tokens_used || 0,
      blocks: threadBlocks[t.id] || [],
      fileIds: [],
    })),
  }));

  const project = projectsWithThreads.find((p) => p.id === projectId) ?? projectsWithThreads[0];
  const thread = project?.threads.find((t) => t.id === threadId) ?? project?.threads[0];
  const allThreads = projectsWithThreads.flatMap((p) => p.threads);

  // Work items derived from threads
  const workItems: WorkItem[] = apiThreads.map((t: any) => {
    return {
      id: t.id,
      title: t.title,
      projectId: t.project_id,
      branch: t.branch || "",
      add: 0, del: 0,
      agent: t.model_id || "agent",
      time: t.updated_at,
      lane: t.status === "running" ? "running" : t.status === "review" ? "review" : t.status === "done" ? "merged" : "queued" as any,
      threadId: t.id,
      surface: "code" as const,
    };
  });

  const toast = useCallback((msg: string) => {
    const id = ++tid.current;
    setToasts((p) => [...p.slice(-2), { id, msg }]);
    window.setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800);
  }, []);

  // WebSocket for real-time updates (only when authenticated — never with a stale token)
  useWebSocket(authed, (msg) => {
    if (msg.type === "notification") {
      toast(msg.data.title);
      api.playNotificationSound();
      api.showDesktopNotification(msg.data.title, msg.data.body);
    }
    if (msg.type === "thread_update") {
      refreshThreads();
      refreshBilling();
    }
  });

  const newThread = useCallback(async (pid?: string, prompt?: string) => {
    const targetProject = pid || projectId;
    if (!targetProject) { setView("picker"); toast("Add a project to start"); return; }
    try {
      const data = await api.threads.create({
        project_id: targetProject,
        title: prompt ? prompt.slice(0, 50) : "New Thread",
        mode: "agent",
        model_id: model || undefined,
      });
      setProjectId(targetProject);
      setThreadId(data.id);
      setView("agent");
      setPalette(false);
      refreshThreads();
      return data.id;
    } catch (err: any) {
      toast(err.message);
    }
  }, [projectId, model, toast, refreshThreads]);

  const send = async (text: string) => {
    if (!thread) return;
    setWorking(true);
    setActiveTool("Thinking");

    try {
      let res = await api.threads.send(thread.id, text);
      const applyBlocks = (data: any) => {
        if (data?.blocks) setThreadBlocks((prev) => ({ ...prev, [thread.id]: mapServerBlocks(data.blocks) }));
        refreshThreads();
        const tool = data?.blocks?.slice(-1)[0];
        if (tool?.kind === "tool") setActiveTool(tool.data?.tool);
      };
      applyBlocks(res);
      let step = res?.result?.step || 0;
      let done = res?.result?.done;

      // Continue stepping (stop + resend) until the agent reports completion
      while (!done) {
        if (step >= 30) { done = true; break; }
        res = await api.threads.continueRun(thread.id);
        applyBlocks(res);
        done = res?.result?.done;
        step = res?.result?.step;
      }

      setActiveTool(null);
      setWorking(false);
      toast(done ? "Agent finished" : "Agent reached the step limit");
    } catch (err: any) {
      setActiveTool(null);
      setWorking(false);
      toast(err.message);
    }
  };

  const parallel = async (goal: string, breakdown: { name: string; task: string }[]) => {
    if (!thread) return;
    setWorking(true);
    setActiveTool("Parallel agents");
    try {
      const res = await api.threads.parallel(thread.id, { goal, breakdown });
      if (res?.blocks) setThreadBlocks((prev) => ({ ...prev, [thread.id]: mapServerBlocks(res.blocks) }));
      refreshThreads();
      toast("Parallel agents finished");
    } catch (err: any) {
      toast(err.message);
    } finally {
      setActiveTool(null);
      setWorking(false);
    }
  };

  const stop = async () => {
    if (!thread) return;
    try { await api.threads.stop(thread.id); } catch {}
    setWorking(false);
    setActiveTool(null);
    toast("Agent stopped");
  };

  const commit = async () => {
    if (!thread) return;
    try {
      await api.threads.commit(thread.id);
      refreshThreads();
      toast(`Pushed to origin/${thread.branch}`);
    } catch (err: any) { toast(err.message); }
  };

  const openProject = (id: string, prompt?: string) => {
    setProjectId(id);
    const p = projectsWithThreads.find((x) => x.id === id);
    if (prompt) {
      newThread(id, prompt);
    } else {
      const first = p?.threads[0];
      if (first) { setThreadId(first.id); setView("agent"); }
      else newThread(id);
    }
    setTab("preview");
  };

  const runCmd = (c: CommandItem) => {
    setPalette(false);
    const r = c.run;
    if (["work", "agent", "workflows", "automations", "picker", "settings"].includes(r)) setView(r as View);
    else if (r === "newthread") newThread();
    else if (r === "commit") commit();
    else if (r === "pr") toast("Draft PR opened");
    else if (r === "design") { setView("agent"); setTab("preview"); setShowPanel(true); }
    else if (r.startsWith("tab:")) { setView("agent"); setTab(r.split(":")[1] as PanelTab); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); setPalette((v) => !v); }
      else if (k === "n") { e.preventDefault(); newThread(); }
      else if (k === "p") { e.preventDefault(); setView("picker"); }
      else if (k === "\\") { e.preventDefault(); setShowPanel((v) => !v); }
      else if (k === "b") { e.preventDefault(); setShowSide((v) => !v); }
      else if (["1", "2", "3", "4"].includes(k)) {
        e.preventDefault();
        setView((["work", "agent", "workflows", "automations"] as View[])[Number(k) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newThread]);

  // Auth check on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem("kiren_token");
      if (!storedToken) { setAuthStage("login"); return; }
      try {
        const data = await api.auth.session();
        setAuthToken(storedToken);
        setAuthUser(data.user);
        await api.requestNotificationPermission();
        if (data.user.plan_id) {
          try { const p = await api.billing.plans(); setAuthPlan(p.plans.find((x: any) => x.id === data.user.plan_id)); } catch {}
        }
        if (data.user.plan_selected === false) {
          setAuthStage("pricing");
          return;
        }
        setAuthStage("app");
        try { await api.sandboxes.create("main"); } catch {}
        refreshSandbox();
      } catch {
        localStorage.removeItem("kiren_token");
        setAuthStage("login");
      }
    };
    checkSession();
  }, []);

  // Set first project/thread when data loads
  useEffect(() => {
    if (projectsWithThreads.length > 0 && !projectId) {
      setProjectId(projectsWithThreads[0].id);
      const firstThread = projectsWithThreads[0].threads[0];
      if (firstThread) setThreadId(firstThread.id);
    }
  }, [projectsWithThreads, projectId]);

  // New user with no projects yet — scaffold a starter project from a template
  // + create the welcome thread so the chat and editor both open immediately.
  useEffect(() => {
    if (authStage !== "app" || projectsLoading) return;
    if (projectsWithThreads.length > 0) return;
    let cancelled = false;
    (async () => {
      let pid = "";
      try {
        const created = await api.projects.create({ name: "My First App", source: "template", files: STARTER_TEMPLATE });
        pid = created.project?.id || "";
      } catch {}
      if (cancelled) return;
      try {
        const t: any = await api.threads.create({ project_id: pid || undefined, title: "Welcome to Kiren", mode: "agent", model_id: model || undefined });
        if (cancelled) return;
        setProjectId(t.project_id);
        setThreadId(t.id);
        setView("agent");
        refreshProjects();
        refreshThreads();
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStage, projectsLoading, projectsWithThreads.length]);

  // Load blocks for the active thread
  useEffect(() => {
    if (!threadId || threadBlocks[threadId]) return;
    let cancelled = false;
    api.threads.get(threadId).then((data: any) => {
      if (cancelled || !data?.blocks) return;
      setThreadBlocks((prev) => ({ ...prev, [threadId]: mapServerBlocks(data.blocks) }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [threadId]);

  // Default model = qwen3.7-max (preferred test model), else the first real model
  useEffect(() => {
    if (model) return;
    const preferred = realModels.find((m: any) => m.id === "qwen3.7-max");
    if (preferred) setModel(preferred.id);
    else if (realModels.length > 0) setModel(realModels[0].id);
  }, [realModels, model]);

  const handleLogin = async (token: string, user: any) => {
    localStorage.setItem("kiren_token", token);
    setAuthToken(token);
    setAuthUser(user);

    // New users must pick a plan first — skip all data + sandbox work until they do
    if (user.plan_selected === false) {
      setAuthStage("pricing");
      return;
    }

    try { await api.github.sync(); } catch {}
    refreshProjects();
    if (user.plan_id) {
      try { const p = await api.billing.plans(); setAuthPlan(p.plans.find((x: any) => x.id === user.plan_id)); } catch {}
    }
    refreshBilling();
    try { await api.sandboxes.create("main"); } catch {}
    refreshSandbox();
    setAuthStage("app");
  };

  const handlePlanSelected = async (plan: any) => {
    setAuthPlan(plan);
    setAuthUser((user: any) => user ? { ...user, plan_selected: true, plan_id: plan.id } : user);
    try { await api.sandboxes.create("main"); } catch {}
    refreshBilling();
    refreshSandbox();
    setAuthStage("app");
  };

  const handleLogout = async () => {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem("kiren_token");
    setAuthToken(null); setAuthUser(null); setAuthPlan(null);
    setAuthStage("login");
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {authStage === "loading" && (
          <div key="loading" className="h-full flex items-center justify-center bg-[var(--app)]">
            <Icon name="spinner" size={28} className="a-spin text-[var(--accent)]" />
          </div>
        )}

        {authStage === "login" && <LoginScreen key="login" onLogin={handleLogin} />}

        {authStage === "pricing" && (
          <PricingScreen key="pricing" user={authUser} token={authToken || ""} onPlanSelected={handlePlanSelected} />
        )}

        {authStage === "app" && (
          <div key="app" className="relative flex h-full flex-col overflow-hidden bg-[var(--app)]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 left-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--accent-warm)]/10 blur-[100px]" />
              <div className="absolute -bottom-32 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--blue)]/8 blur-[80px]" />
              <div className="absolute inset-0 claude-dots-soft" />
            </div>

            <div className="relative flex h-full flex-col">
              {/* Top bar */}
              <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--chrome)]/90 px-3 backdrop-blur-xl">
                <IconBtn icon="panel" size={14} active={showSide} onClick={() => setShowSide((v) => !v)} title="Sidebar ⌘B" />
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-semibold text-[var(--text)]">{project?.name ?? "Kiren"}</span>
                  {working && activeTool && (
                    <>
                      <span className="text-[var(--border-3)]">·</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                        <Icon name="spinner" size={10} className="a-spin text-[var(--blue)]" />
                        {activeTool}
                      </span>
                    </>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-0.5">
                  <IconBtn icon="columns" size={14} active={showPanel} onClick={() => setShowPanel((v) => !v)} title="Panel ⌘\" />
                </div>
              </div>

              {/* Main layout */}
              <div className="flex min-h-0 flex-1">
                {showSide && (
                  <Sidebar
                    project={project}
                    projects={projectsWithThreads}
                    threads={project?.threads ?? []}
                    activeId={threadId}
                    view={view}
                    compact={compact}
                    user={authUser}
                    plan={authPlan}
                    billing={billing}
                    onSelect={(id) => { setThreadId(id); setView("agent"); }}
                    onNavigate={setView}
                    onNewThread={() => newThread()}
                    onSwitchProject={(id) => openProject(id)}
                    onCreateProject={() => { setView("picker"); }}
                    onOpenSettings={() => setView("settings")}
                  />
                )}

                <main className="flex min-w-0 flex-1">
                  {view === "work" && (
                    <MyWork
                      items={workItems}
                      projects={projectsWithThreads}
                      sandbox={sandbox}
                      onOpen={(tId, pId) => {
                        if (pId) setProjectId(pId);
                        if (tId) setThreadId(tId);
                        setView("agent");
                      }}
                      onNewThread={() => newThread()}
                      onToast={toast}
                      onMerge={async (id) => {
                        try { await api.threads.commit(id); refreshThreads(); toast("Merged"); } catch (err: any) { toast(err.message); }
                      }}
                    />
                  )}

                  {view === "picker" && (
                    <ProjectPicker
                      projects={projectsWithThreads}
                      projectId={projectId}
                      user={authUser}
                      onSelectProject={(id) => openProject(id)}
                      onOpen={(id, prompt) => openProject(id, prompt)}
                      onOpenThread={(tid, pid) => { setProjectId(pid); setThreadId(tid); setView("agent"); }}
                      onImport={async () => { try { await api.github.sync(); } catch {} refreshProjects(); }}
                      onToast={toast}
                    />
                  )}

                  {view === "agent" && !project && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--panel-2)] border border-[var(--border)]">
                        <Icon name="boxes" size={22} className="text-[var(--accent)]" />
                      </div>
                      <div className="text-center">
                        <p className="text-[15px] font-semibold text-[var(--text)]">No project selected</p>
                        <p className="mt-1 max-w-[320px] text-[12.5px] leading-relaxed text-[var(--muted)]">
                          Add a project from GitHub or browse all your threads to get started.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setView("picker")}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-2)]"
                        >
                          <Icon name="plus" size={13} /> Add a project
                        </button>
                        <button
                          onClick={() => setView("work")}
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-[var(--panel)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-[var(--panel-2)]"
                        >
                          View all threads
                        </button>
                      </div>
                    </div>
                  )}

                  {view === "agent" && project && thread && (
                    <>
                      <AgentView
                        thread={thread}
                        project={project}
                        allProjects={projectsWithThreads}
                        files={project.files}
                        working={working}
                        activeTool={activeTool}
                        mode={mode}
                        model={model}
                        models={realModels}
                        onMode={setMode}
                        onModel={(m) => {
                          setModel(m);
                          if (thread) api.threads.setModel(thread.id, m).then(refreshThreads).catch(() => {});
                        }}
                        onSend={(t) => send(t)}
                        onParallel={(g, b) => parallel(g, b)}
                        onStop={stop}
                        onCommit={commit}
                        onPR={() => toast("PR opened")}
                        onOpenTab={(t) => { setTab(t); setShowPanel(true); }}
                        onDesign={() => { setTab("preview"); setShowPanel(true); toast("Opening live preview"); }}
                        onClear={() => toast("Thread cleared")}
                        onSwitchProject={(id) => openProject(id)}
                        onNewProject={() => setView("picker")}
                      />
                      {showPanel && (
                        <RightPanel
                          project={project}
                          files={project.files}
                          tab={tab}
                          onTab={setTab}
                          onToast={toast}
                          threadId={thread?.id}
                        />
                      )}
                    </>
                  )}

                  {view === "workflows" && <Workflows onToast={toast} />}
                  {view === "automations" && <AutomationsView onToast={toast} />}
                  {view === "settings" && (
                    <Settings
                      onToast={toast}
                      onLogout={handleLogout}
                      user={authUser}
                      plan={authPlan}
                      billing={billing}
                      sandbox={sandbox}
                      threads={apiThreads}
                    />
                  )}
                </main>
              </div>

              {/* Bottom status bar */}
              <div className="flex h-6 shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--chrome)]/90 px-3 text-[10.5px] text-[var(--faint)]">
                <span className="flex items-center gap-1">
                  <Icon name="boxes" size={10} className="text-[var(--accent)]" />
                  {project?.name ?? "no project"}
                </span>
                {thread && (
                  <span className="hidden items-center gap-1 sm:flex">
                    <Icon name="branchSm" size={10} />
                    <span className="font-mono">{thread.branch}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className={cn("h-1.5 w-1.5 rounded-full", working ? "bg-[var(--blue)] animate-pulse" : "bg-[var(--green)]")} />
                  {working ? activeTool ?? "running" : "idle"}
                </span>
                <span className="ml-auto font-mono">{model || "…"}</span>
                {billing && <span className="font-mono text-[var(--green)]">${(billing.balance ?? 0).toFixed(2)}</span>}
              </div>

              <CommandPalette
                open={palette}
                threads={allThreads}
                onClose={() => setPalette(false)}
                onRun={runCmd}
                onThread={(id) => {
                  const owner = projectsWithThreads.find((p) => p.threads.some((t) => t.id === id));
                  if (owner) setProjectId(owner.id);
                  setThreadId(id); setView("agent"); setPalette(false);
                }}
              />

              <div className="pointer-events-none fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
                {toasts.map((t) => (
                  <div key={t.id} className="a-toast pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-[12.5px] font-medium text-[var(--text)] shadow-[var(--shadow-lg)] glow-sm">
                    <Icon name="checkCircle" size={13} className="text-[var(--green)]" />
                    {t.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
