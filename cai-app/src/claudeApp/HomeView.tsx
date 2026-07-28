import { useState } from "react";
import { c, font, mono } from "./theme";
import Composer, { type Attachment } from "./Composer";
import { useGitHub } from "./github";

const suggestions = [
  { title: "Build a feature", sub: "Create a login page with validation" },
  { title: "Fix a bug", sub: "Debug the failing test in auth.spec.ts" },
  { title: "Set up a database", sub: "Add Postgres with a users table" },
  { title: "Optimize performance", sub: "Profile and speed up the build" },
];

export default function HomeView({ userName, onSubmit }: { userName: string; onSubmit: (text: string, attachments: Attachment[]) => void }) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("Interactive");
  const [model, setModel] = useState("Auto");
  const [effort, setEffort] = useState("Extended");
  const gh = useGitHub();

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full overflow-y-auto" style={{ backgroundColor: c.bg, fontFamily: font }}>
      <div className="mb-7 text-center">
        <div className="text-[28px] font-semibold tracking-tight mb-1" style={{ color: c.text }}>What&rsquo;s up next, {userName}?</div>
        <div className="text-[13px]" style={{ color: c.muted }}>
          Connected to <span style={{ fontFamily: mono, color: c.text }}>{gh.selectedRepo ?? "no repo selected"}</span> on <span style={{ fontFamily: mono, color: c.text }}>{gh.selectedBranch ?? "main"}</span>
        </div>
      </div>
      <div className="w-full px-6" style={{ maxWidth: 700 }}>
        <Composer value={message} onChange={setMessage} onSubmit={onSubmit} placeholder="Describe a task…   / for commands, @ for files" rows={4} showEnv mode={mode} onMode={setMode} model={model} onModel={setModel} effort={effort} onEffort={setEffort} dropDirection="down" maxContext={1000000} />
        <div className="mt-2 px-3 py-2 rounded-xl text-[11px] flex items-center gap-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, color: c.muted }}>
          <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: c.accent }} />
          <span style={{ color: c.text }}>Cloud</span><span>·</span>
          <span>GitHub Actions sandbox · {gh.repos.length} repos available</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {suggestions.map((s) => (
            <button key={s.title} onClick={() => setMessage(s.sub)} className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-colors"
              style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.panel)}>
              <span><span className="block text-[12.5px] font-medium" style={{ color: c.muted }}>{s.title}</span><span className="block text-[11.5px]" style={{ color: c.dim }}>{s.sub}</span></span>
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] mt-4" style={{ color: c.dim }}>
          <span style={{ fontFamily: mono }}>/</span> commands · <span style={{ fontFamily: mono }}>@</span> context · <span style={{ fontFamily: mono }}>+</span> attach
        </p>
      </div>
    </div>
  );
}
