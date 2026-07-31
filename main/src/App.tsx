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
import { IconBtn } from "./components/ui";
import {
  makeDiff,
  projects as seedProjects,
  seedWork,
  type Block,
  type CommandItem,
  type Project,
  type Thread,
  type WorkItem,
} from "./data";

const API_BASE = "http://localhost:3001/api";

interface Toast { id: number; msg: string }

type AuthStage = "loading" | "login" | "pricing" | "app";

export default function App() {
  const [compact, setCompact] = useState(false);
  const [view, setView] = useState<View>("agent"); // Opens directly in agent/thread view
  const [projects, setProjects] = useState<Project[]>(seedProjects);
  const [projectId, setProjectId] = useState(seedProjects[0].id);
  const [threadId, setThreadId] = useState(seedProjects[0].threads[0]?.id ?? "");
  const [work, setWork] = useState<WorkItem[]>(seedWork);
  const [tab, setTab] = useState<PanelTab>("preview");
  const [design, setDesign] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showSide, setShowSide] = useState(true); // Sidebar is ALWAYS visible on start
  const [working, setWorking] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [mode, setMode] = useState<"agent" | "plan" | "ask">("agent");
  const [model] = useState("kiren-2.5");
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const timers = useRef<number[]>([]);

  // Auth state
  const [authStage, setAuthStage] = useState<AuthStage>("loading");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authPlan, setAuthPlan] = useState<any>(null);

  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const thread = project?.threads.find((t) => t.id === threadId) ?? project?.threads[0];
  const allThreads = projects.flatMap((p) => p.threads);

  const toast = useCallback((msg: string) => {
    const id = ++tid.current;
    setToasts((p) => [...p.slice(-2), { id, msg }]);
    window.setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800);
  }, []);

  const patchProject = (id: string, fn: (p: Project) => Project) =>
    setProjects((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));

  const patchThread = (pid: string, tid2: string, fn: (t: Thread) => Thread) =>
    patchProject(pid, (p) => ({ ...p, threads: p.threads.map((t) => (t.id === tid2 ? fn(t) : t)) }));

  const newThread = useCallback(
    (pid = projectId, prompt?: string) => {
      const id = `th-${Date.now()}`;
      const p = projects.find((x) => x.id === pid);
      const t: Thread = {
        id,
        projectId: pid,
        title: prompt ? prompt.slice(0, 38) + (prompt.length > 38 ? "…" : "") : "New Thread",
        status: "draft",
        updated: "now",
        model: "Kiren 2.5",
        branch: `${(p?.name ?? "work").slice(0, 6)}/thread-${String(Date.now()).slice(-4)}`,
        tokens: 1400,
        blocks: [],
        fileIds: [],
      };
      patchProject(pid, (pr) => ({ ...pr, threads: [t, ...pr.threads] }));
      setProjectId(pid);
      setThreadId(id);
      setView("agent");
      setPalette(false);
      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, projects],
  );

  const stop = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setWorking(false);
    setActiveTool(null);
    toast("Agent stopped");
  };

  const send = (text: string, pid = projectId, tId = threadId) => {
    patchThread(pid, tId, (t) => ({
      ...t,
      status: "running",
      title: t.blocks.length === 0 ? text.slice(0, 38) + (text.length > 38 ? "…" : "") : t.title,
      blocks: [...t.blocks, { k: "user", text } as Block],
    }));
    setWorking(true);

    const file = makeDiff(`src/${text.split(" ")[0].replace(/\W/g, "").toLowerCase() || "task"}/index.ts`);
    const steps: { at: number; tool?: string; block: Block }[] = [
      { at: 450, tool: "Thinking", block: { k: "thinking", ms: 2400, text: `Analyzing task "${text}". Planning file modifications and running automated verification.` } },
      { at: 950, tool: "Planning", block: { k: "todo", items: [{ label: "Locate target modules", state: "done" }, { label: "Apply file patch", state: "active" }, { label: "Run test suite", state: "todo" }, { label: "Rebuild live preview", state: "todo" }] } },
      { at: 1400, tool: "Grep", block: { k: "tool", tool: "Grep", icon: "search", target: text.split(" ").slice(0, 3).join(" "), meta: "8 matches · 3 files", status: "done", output: ["src/index.ts:24   export function handleInit()", "src/ui/App.tsx:82   <TaskRunner />"] } },
      { at: 1900, tool: "Read", block: { k: "tool", tool: "Read", icon: "file", target: file.path, meta: "128 lines", status: "done" } },
      { at: 2600, tool: "Write", block: { k: "permission", tool: "Write", detail: `Modify ${file.path}`, resolved: "allow" } },
      { at: 3200, tool: "Edit", block: { k: "diff", fileIds: [file.id] } },
      { at: 3900, tool: "Bash", block: { k: "terminal", cmd: "pnpm exec vitest run --changed", exit: 0, lines: ["RUN  v2.1.4", "", " ✓ src/__tests__/task.spec.ts (6)", " Test Files  1 passed (1)", " Duration  1.42s"] } },
      { at: 4500, block: { k: "preview", label: "Preview updated — open preview tab to inspect" } },
      {
        at: 5000,
        block: {
          k: "summary",
          title: "Changes ready for review",
          bullets: [`Implemented changes in \`${file.path}\`.`, "Automated tests passing.", "Live preview updated — click Design Cursor to tweak visually."],
        },
      },
    ];

    steps.forEach((s) => {
      const h = window.setTimeout(() => {
        if (s.tool) setActiveTool(s.tool);
        patchThread(pid, tId, (t) => ({ ...t, tokens: t.tokens + 1800, blocks: [...t.blocks, s.block] }));
        if (s.block.k === "diff") {
          patchProject(pid, (p) => ({ ...p, files: [...p.files, file] }));
          setTab("changes");
        }
        if (s.block.k === "preview") setTab("preview");
      }, s.at);
      timers.current.push(h);
    });

    const done = window.setTimeout(() => {
      setWorking(false);
      setActiveTool(null);
      patchThread(pid, tId, (t) => ({ ...t, status: "review", updated: "now" }));
      toast(`Thread finished · +${file.add} −${file.del}`);
    }, 5200);
    timers.current.push(done);
  };

  const openProject = (id: string, prompt?: string) => {
    const p = projects.find((x) => x.id === id);
    setProjectId(id);
    if (prompt) {
      const t = newThread(id, prompt);
      setTimeout(() => send(prompt, id, t), 120);
    } else {
      const first = p?.threads[0];
      if (first) {
        setThreadId(first.id);
        setView("agent");
      } else newThread(id);
    }
    setTab("preview");
  };

  const commit = () => {
    if (!thread) return;
    patchThread(project.id, thread.id, (t) => ({ ...t, status: "done" }));
    toast(`Pushed to origin/${thread.branch}`);
  };

  const clearThread = () => {
    if (!thread) return;
    patchThread(project.id, thread.id, (t) => ({ ...t, blocks: [], tokens: 1200, title: "New Thread" }));
    toast("Thread cleared");
  };

  const runCmd = (c: CommandItem) => {
    setPalette(false);
    const r = c.run;
    if (["work", "agent", "workflows", "automations", "picker", "settings"].includes(r)) setView(r as View);
    else if (r === "newthread") newThread();
    else if (r === "commit") commit();
    else if (r === "pr") toast("Draft PR #5467 opened");
    else if (r === "design") { setView("agent"); setTab("preview"); setDesign((d) => !d); }
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

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem("kiren_token");
      if (!storedToken) {
        setAuthStage("login");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/session`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAuthToken(storedToken);
          setAuthUser(data.user);

          // Check if user has a plan
          if (data.user.plan_id && data.user.plan_id !== "free") {
            // Fetch plan details
            const planRes = await fetch(`${API_BASE}/user/plans`);
            const planData = await planRes.json();
            const userPlan = planData.plans.find((p: any) => p.id === data.user.plan_id);
            setAuthPlan(userPlan);
            setAuthStage("app");
          } else {
            // Free plan or no plan - show pricing
            setAuthStage("pricing");
          }
        } else {
          localStorage.removeItem("kiren_token");
          setAuthStage("login");
        }
      } catch {
        localStorage.removeItem("kiren_token");
        setAuthStage("login");
      }
    };

    checkSession();
  }, []);

  const handleLogin = (token: string, user: any) => {
    localStorage.setItem("kiren_token", token);
    setAuthToken(token);
    setAuthUser(user);

    // Check plan
    if (user.plan_id && user.plan_id !== "free") {
      setAuthStage("app");
    } else {
      setAuthStage("pricing");
    }
  };

  const handlePlanSelected = (plan: any) => {
    setAuthPlan(plan);
    setAuthStage("app");
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem("kiren_token");
    setAuthToken(null);
    setAuthUser(null);
    setAuthPlan(null);
    setAuthStage("login");
  };

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {/* Loading state */}
        {authStage === "loading" && (
          <div key="loading" className="h-full flex items-center justify-center bg-[var(--app)]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] flex items-center justify-center animate-pulse">
                <span className="text-white text-xl font-bold">K</span>
              </div>
              <p className="text-sm text-[var(--muted)]">Loading...</p>
            </div>
          </div>
        )}

        {/* Login screen */}
        {authStage === "login" && (
          <LoginScreen key="login" onLogin={handleLogin} />
        )}

        {/* Pricing screen */}
        {authStage === "pricing" && (
          <PricingScreen
            key="pricing"
            user={authUser}
            token={authToken!}
            onPlanSelected={handlePlanSelected}
          />
        )}

        {/* Main app */}
        {authStage === "app" && (
          <div key="app" className="relative flex h-full flex-col overflow-hidden bg-[var(--app)]">

        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--accent-warm)]/10 blur-[100px]" />
          <div className="absolute -bottom-32 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--blue)]/8 blur-[80px]" />
          <div className="absolute top-1/2 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-warm)]/5 blur-[120px]" />
          <div className="absolute inset-0 claude-dots-soft" />
        </div>

        <div className="relative flex h-full flex-col">
          {/* Top bar — project name + active tool only */}
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
              {working && !activeTool && (
                <>
                  <span className="text-[var(--border-3)]">·</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--blue)]" />
                    running
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
                projects={projects}
                threads={project?.threads ?? []}
                activeId={threadId}
                view={view}
                compact={compact}
                onSelect={(id) => { setThreadId(id); setView("agent"); }}
                onNavigate={setView}
                onNewThread={() => newThread()}
                onSwitchProject={(id) => openProject(id)}
                onCreateProject={() => toast("Create project — import from GitHub or upload a folder")}
                onOpenSettings={() => setView("settings")}
              />
            )}

            <main className="flex min-w-0 flex-1">
              {view === "work" && (
                <MyWork
                  items={work}
                  projects={projects}
                  onOpen={(tId, pId) => {
                    if (pId) setProjectId(pId);
                    if (tId) setThreadId(tId);
                    setView("agent");
                  }}
                  onNewThread={() => newThread()}
                  onToast={toast}
                  onMerge={(id) => setWork((p) => p.map((w) => (w.id === id ? { ...w, lane: "merged", time: "just now" } : w)))}
                />
              )}

              {(view === "agent" || view === "picker") && project && thread && (
                <>
                  <AgentView
                    thread={thread}
                    project={project}
                    allProjects={projects}
                    files={project.files}
                    working={working}
                    activeTool={activeTool}
                    mode={mode}
                    model={model}
                    onMode={setMode}
                    onSend={(t) => send(t)}
                    onStop={stop}
                    onCommit={commit}
                    onPR={() => toast(`PR opened for ${thread.branch}`)}
                    onOpenTab={(t) => { setTab(t); setShowPanel(true); }}
                    onDesign={() => { setTab("preview"); setShowPanel(true); setDesign(true); toast("Design Cursor active"); }}
                    onClear={clearThread}
                    onSwitchProject={(id) => openProject(id)}
                    onNewProject={() => toast("Import a project from the project switcher")}
                  />
                  {showPanel && (
                    <RightPanel
                      project={project}
                      files={project.files}
                      tab={tab}
                      onTab={setTab}
                      design={design}
                      onDesign={setDesign}
                      nodes={project.preview}
                      onNodePatch={(id, text, accent) =>
                        patchProject(project.id, (p) => ({
                          ...p,
                          preview: p.preview.map((n) => (n.id === id ? { ...n, text, accent } : n)),
                        }))
                      }
                      onToast={toast}
                    />
                  )}
                </>
              )}

              {view === "workflows"   && <Workflows onToast={toast} />}
              {view === "automations" && <AutomationsView onToast={toast} />}
              {view === "settings"    && <Settings onToast={toast} />}
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
            <span className="ml-auto font-mono">{model}</span>
          </div>

          <CommandPalette
            open={palette}
            threads={allThreads}
            onClose={() => setPalette(false)}
            onRun={runCmd}
            onThread={(id) => {
              const owner = projects.find((p) => p.threads.some((t) => t.id === id));
              if (owner) setProjectId(owner.id);
              setThreadId(id);
              setView("agent");
              setPalette(false);
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
