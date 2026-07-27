import { useState } from "react";
import { Bug, Database, Gauge, Sparkles, Wrench } from "lucide-react";
import { c, font, mono } from "./theme";
import Composer, { type Attachment } from "./Composer";
import { environments } from "./data";
import type { SlashCommand } from "./workData";

const suggestions = [
  { icon: Wrench, title: "Refactor a module", sub: "Split Lighting.js into rig + presets" },
  { icon: Bug, title: "Reproduce a bug", sub: "Short-code collisions on retry" },
  { icon: Database, title: "Write a migration", sub: "Add index on links.created_at" },
  { icon: Gauge, title: "Profile the build", sub: "Find what costs 4s in vite build" },
];

export default function HomeView({
  userName,
  env,
  onEnv,
  onSubmit,
  onCommand,
}: {
  userName: string;
  env: string;
  onEnv: (id: string) => void;
  onSubmit: (text: string, attachments: Attachment[]) => void;
  onCommand: (cmd: SlashCommand) => void;
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("Interactive");
  const [model, setModel] = useState("cai-luna-1");
  const [effort, setEffort] = useState("Standard");

  const envMeta = environments.find((e) => e.id === env);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center h-full overflow-y-auto"
      style={{ backgroundColor: c.bg, fontFamily: font }}
    >
      <div className="mb-7 text-center">
        <div className="text-[28px] font-semibold tracking-tight mb-1" style={{ color: c.text }}>
          What&rsquo;s up next, {userName}?
        </div>
        <div className="text-[13px]" style={{ color: c.muted }}>
          Choose an environment now — it stays fixed for the life of the thread.
        </div>
      </div>

      <div className="w-full px-6" style={{ maxWidth: 700 }}>
        <Composer
          value={message}
          onChange={setMessage}
          onSubmit={onSubmit}
          onCommand={onCommand}
          placeholder="Describe a task…   / for commands, @ for files"
          rows={4}
          showEnv
          env={env}
          onEnv={onEnv}
          mode={mode}
          onMode={setMode}
          model={model}
          onModel={setModel}
          effort={effort}
          onEffort={setEffort}
          dropDirection="down"
        />

        {envMeta && (
          <div
            className="mt-2 px-3 py-2 rounded-xl text-[11px] flex items-center gap-2"
            style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, color: c.muted }}
          >
            <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: c.accent }} />
            <span style={{ color: c.text }}>{envMeta.name}</span>
            <span>·</span>
            <span>{envMeta.desc}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          {suggestions.map((s) => (
            <button
              key={s.title}
              onClick={() => setMessage(s.sub)}
              className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-colors"
              style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.panel)}
            >
              <s.icon size={14} color={c.muted} className="mt-0.5" />
              <span>
                <span className="block text-[12.5px] font-medium" style={{ color: c.text }}>
                  {s.title}
                </span>
                <span className="block text-[11.5px]" style={{ color: c.faint }}>
                  {s.sub}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] mt-4 flex items-center justify-center gap-1.5" style={{ color: c.dim }}>
          <Sparkles size={11} />
          <span style={{ fontFamily: mono }}>/</span> commands ·{" "}
          <span style={{ fontFamily: mono }}>@</span> context ·{" "}
          <span style={{ fontFamily: mono }}>+</span> attach
        </p>
      </div>
    </div>
  );
}
