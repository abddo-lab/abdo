import { useCallback, useEffect, useState } from "react";
import TitleBar from "./claudeApp/TitleBar";
import Sidebar from "./claudeApp/Sidebar";
import HomeView from "./claudeApp/HomeView";
import ChatSession from "./claudeApp/ChatSession";
import RightPanel from "./claudeApp/RightPanel";
import UsagePanel from "./claudeApp/UsagePanel";
import MyWorkPanel from "./claudeApp/MyWorkPanel";
import SettingsPanel from "./claudeApp/SettingsPanel";
import AutomationsPanel from "./claudeApp/AutomationsPanel";
import ToolsPanel from "./claudeApp/ToolsPanel";
import { c, font } from "./claudeApp/theme";
import { GitHubProvider } from "./claudeApp/github";
import { AuthProvider, useAuth } from "./claudeApp/auth";
import LoginView from "./claudeApp/LoginView";
import type { SlashCommand } from "./claudeApp/workData";

type View = "home" | "thread" | "work" | "usage" | "automations" | "tools" | "settings";

export default function App() {
  return (
    <AuthProvider>
      <GitHubProvider>
        <CaretAgent />
      </GitHubProvider>
    </AuthProvider>
  );
}

function CaretAgent() {
  const auth = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [view, setView] = useState<View>("thread");
  const [session, setSession] = useState<string | null>("Tailspin Toys — night lighting");

  /* env is chosen once, when the thread is created — never inside the chat */
  const [draftEnv, setDraftEnv] = useState("local");
  const [threadEnv, setThreadEnv] = useState("local");

  const newThread = useCallback(() => {
    setSession(null);
    setView("home");
  }, []);

  const openThread = useCallback((label: string, env?: string) => {
    setSession(label);
    if (env) setThreadEnv(env);
    setView("thread");
  }, []);

  /* cloud requires GitHub — fall back to local when it disconnects */
  useEffect(() => {
    const fallback = () => {
      setDraftEnv("local");
      setThreadEnv("local");
    };
    window.addEventListener("caret:github-disconnected", fallback);
    return () => window.removeEventListener("caret:github-disconnected", fallback);
  }, []);

  /* global shortcuts */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "n") {
        e.preventDefault();
        newThread();
      } else if (e.key === "1") {
        e.preventDefault();
        setView("work");
      } else if (e.key === "2") {
        e.preventDefault();
        setView("usage");
      } else if (e.key === "3") {
        e.preventDefault();
        setView("automations");
      } else if (e.key === "4") {
        e.preventDefault();
        setView("tools");
      } else if (e.key === "5") {
        e.preventDefault();
        setView("settings");
      } else if (e.key === "b") {
        e.preventDefault();
        setSidebarOpen((s) => !s);
      } else if (e.key === "j") {
        e.preventDefault();
        setPanelOpen((p) => !p);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [newThread]);

  const homeCommand = (cmd: SlashCommand) => {
    if (cmd.action === "cost") setView("usage");
    else if (cmd.action === "work") setView("work");
    else if (cmd.action === "settings") setView("settings");
  };

  const showPanel = view === "thread" && session && panelOpen;

  if (!auth.isAuthenticated) {
    return (
      <div
        className="flex flex-col h-screen w-full overflow-hidden"
        style={{ fontFamily: font, backgroundColor: c.bg }}
      >
        <LoginView />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden"
      style={{ fontFamily: font, backgroundColor: c.bg }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; height: 100%; background: ${c.bg}; }
        ::selection { background: rgba(255,255,255,0.16); }
        button:focus-visible, textarea:focus-visible, input:focus-visible {
          outline: 1px solid ${c.borderStrong};
          outline-offset: 2px;
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${c.scrollbar}; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
        ::-webkit-scrollbar-track { background: transparent; }
        textarea::placeholder, input::placeholder { color: ${c.dim}; }
        @keyframes popIn { from { opacity: 0; transform: translateY(4px) scale(0.985); } to { opacity: 1; transform: none; } }
        .popIn { animation: popIn 120ms ease-out; }
        @keyframes blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.15; } }
        .blink { animation: blink 1.1s steps(1) infinite; }

        /* ---------- responsive: all screens ---------- */
        .kpiGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .agentGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

        /* laptops & small desktops */
        @media (max-width: 1280px) {
          .workspacePanel { width: 420px !important; }
        }

        /* tablets — collapse the workspace panel and tighten the sidebar */
        @media (max-width: 1024px) {
          .workspacePanel { display: none !important; }
          .appSidebar { width: 208px !important; }
          .agentGrid { grid-template-columns: 1fr; }
        }

        /* small tablets — sidebar becomes an overlay drawer */
        @media (max-width: 860px) {
          .kpiGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .appSidebar {
            position: fixed !important;
            top: 44px; bottom: 0; left: 0;
            z-index: 60;
            width: 248px !important;
            box-shadow: 0 0 40px rgba(0,0,0,.7);
          }
          .sidebarScrim { display: block; }
        }

        /* phones */
        @media (max-width: 640px) {
          .kpiGrid { grid-template-columns: 1fr; }
          .titleWinBtns { display: none !important; }
          .titleNavBtns { display: none !important; }
          .composerRow { gap: 4px !important; }
          .threadMeta { display: none !important; }
          .menuPanel { max-width: calc(100vw - 24px); }
        }

        @media (max-width: 420px) {
          .titleEnvChip { display: none !important; }
        }

        /* touch devices get larger hit targets */
        @media (pointer: coarse) {
          button { min-height: 30px; }
        }
      `}</style>

      <TitleBar
        env={view === "thread" ? threadEnv : draftEnv}
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
        onTogglePanel={() => setPanelOpen((p) => !p)}
        onNewThread={newThread}
      />

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && (
          <>
            <div
              className="sidebarScrim fixed inset-0 z-50"
              style={{ display: "none", backgroundColor: "rgba(0,0,0,.55)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <Sidebar
              activeSession={view === "thread" ? session : null}
              view={view}
              onView={(v) => setView(v)}
              onNewThread={newThread}
              onOpenSession={(label) => openThread(label)}
            />
          </>
        )}

        {view === "usage" && <UsagePanel />}
        {view === "work" && <MyWorkPanel onOpenThread={(l) => openThread(l)} />}
        {view === "automations" && <AutomationsPanel />}
        {view === "tools" && <ToolsPanel />}
        {view === "settings" && <SettingsPanel />}

        {view === "home" && (
          <HomeView
            userName={auth.user?.name.split(" ")[0] ?? "Christina"}
            env={draftEnv}
            onEnv={(id) => setDraftEnv(id)}
            onCommand={homeCommand}
            onSubmit={(text, attachments) => {
              const title =
                text.trim().slice(0, 48) ||
                (attachments[0] ? attachments[0].label : "New thread");
              openThread(title, draftEnv);
            }}
          />
        )}

        {view === "thread" && session && (
          <ChatSession
            key={session}
            sessionName={session}
            env={threadEnv}
            onOpenUsage={() => setView("usage")}
            onOpenWork={() => setView("work")}
            onOpenSettings={() => setView("settings")}
          />
        )}

        {showPanel && <RightPanel env={threadEnv} onClose={() => setPanelOpen(false)} />}
      </div>
    </div>
  );
}
