import { useCallback, useEffect, useState } from "react";
import TitleBar from "./claudeApp/TitleBar";
import Sidebar from "./claudeApp/Sidebar";
import HomeView from "./claudeApp/HomeView";
import ChatSession from "./claudeApp/ChatSession";
import SettingsPanel from "./claudeApp/SettingsPanel";
import AutomationsPanel from "./claudeApp/AutomationsPanel";
import ToolsPanel from "./claudeApp/ToolsPanel";
import MyWorkPanel from "./claudeApp/MyWorkPanel";
import WorkflowsPanel from "./claudeApp/WorkflowsPanel";
import AiIntegrationsPanel from "./claudeApp/AiIntegrationsPanel";
import UsagePanel from "./claudeApp/UsagePanel";
import SimulationPanel from "./claudeApp/SimulationPanel";
import { c, font } from "./claudeApp/theme";
import { GitHubProvider, useGitHub } from "./claudeApp/github";
import { AuthProvider, useAuth } from "./claudeApp/auth";
import LoginView from "./claudeApp/LoginView";
import { threadsDB, type ThreadRecord } from "./services/db";

type View = "home" | "thread" | "work" | "automations" | "tools" | "settings" | "workflows" | "usage" | "ai-integrations" | "simulation";

export default function App() {
  return (
    <GitHubProvider>
      <AuthProvider>
        <CaretAgent />
      </AuthProvider>
    </GitHubProvider>
  );
}

function CaretAgent() {
  const auth = useAuth();
  const gh = useGitHub();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("home");
  const [session, setSession] = useState<string | null>(null);

  const newThread = useCallback(() => { setSession(null); setView("home"); }, []);
  const openThread = useCallback((id: string) => { setSession(id); setView("thread"); }, []);

useEffect(() => {
     const h = (e: KeyboardEvent) => {
       const meta = e.metaKey || e.ctrlKey;
       if (!meta) return;
       if (e.key === "n") { e.preventDefault(); newThread(); }
       else if (e.key === "1") { e.preventDefault(); setView("work"); }
       else if (e.key === "3") { e.preventDefault(); setView("automations"); }
       else if (e.key === "4") { e.preventDefault(); setView("tools"); }
       else if (e.key === "5") { e.preventDefault(); setView("settings"); }
       else if (e.key === "b") { e.preventDefault(); setSidebarOpen((s) => !s); }
       else if (e.key === "w") { e.preventDefault(); setView("workflows"); }
       else if (e.key === "u") { e.preventDefault(); setView("usage"); }
       else if (e.key === "i") { e.preventDefault(); setView("ai-integrations"); }
       else if (e.key === "s") { e.preventDefault(); setView("simulation"); }
     };
     document.addEventListener("keydown", h);
     return () => document.removeEventListener("keydown", h);
   }, [newThread]);

   // URL path-based routing — open /simulation directly
   useEffect(() => {
     const path = window.location.pathname;
     if (path === "/simulation") setView("simulation");
   }, []);

  if (!auth.isAuthenticated) {
    return <div className="flex flex-col h-screen w-full overflow-hidden" style={{ fontFamily: font, backgroundColor: c.bg }}><LoginView /></div>;
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden" style={{ fontFamily: font, backgroundColor: c.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; height: 100%; background: ${c.bg}; }
        ::selection { background: rgba(255,255,255,0.16); }
        button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 1px solid ${c.borderStrong}; outline-offset: 2px; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${c.scrollbar}; border-radius: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        textarea::placeholder, input::placeholder { color: ${c.dim}; }
        @keyframes popIn { from { opacity: 0; transform: translateY(4px) scale(0.985); } to { opacity: 1; transform: none; } }
        .popIn { animation: popIn 120ms ease-out; }
        @keyframes blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.15; } }
        .blink { animation: blink 1.1s steps(1) infinite; }
        .kpiGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @media (max-width: 1024px) { .appSidebar { width: 208px !important; } }
        @media (max-width: 860px) {
          .kpiGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .appSidebar { position: fixed !important; top: 44px; bottom: 0; left: 0; z-index: 60; width: 248px !important; box-shadow: 0 0 40px rgba(0,0,0,.7); }
        }
        @media (max-width: 640px) { .kpiGrid { grid-template-columns: 1fr; } .threadMeta { display: none !important; } }
      `}</style>

      <TitleBar onToggleSidebar={() => setSidebarOpen((s) => !s)} onNewThread={newThread} />

      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && <Sidebar activeSession={view === "thread" ? session : null} view={view} onView={(v) => setView(v)} onNewThread={newThread} onOpenSession={openThread} />}

        {view === "automations" && <AutomationsPanel />}
        {view === "tools" && <ToolsPanel />}
        {view === "settings" && <SettingsPanel />}
        {view === "workflows" && <WorkflowsPanel />}
        {view === "usage" && <UsagePanel />}
        {view === "ai-integrations" && <AiIntegrationsPanel />}
        {view === "simulation" && <SimulationPanel />}
        {view === "work" && <MyWorkPanel onOpenThread={openThread} />}

        {view === "home" && (
          <HomeView
            userName={gh.user?.name?.split(" ")[0] ?? gh.user?.login ?? "Developer"}
            onSubmit={async (text, _attachments) => {
              const title = text.trim().slice(0, 48) || "New thread";
              const repo = gh.selectedRepo ?? "unknown/repo";
              const thread: ThreadRecord = {
                id: `thread-${Date.now()}`, title, repo,
                branch: gh.selectedBranch ?? "main", model: "Auto",
                mode: "Interactive", effort: "High",
                createdAt: Date.now(), updatedAt: Date.now(),
              };
              await threadsDB.put(thread);
              openThread(title);
            }}
          />
        )}

        {view === "thread" && session && (
          <ChatSession
            key={session}
            sessionName={session}
            onOpenSettings={() => setView("settings")}
          />
        )}
      </div>
    </div>
  );
}
