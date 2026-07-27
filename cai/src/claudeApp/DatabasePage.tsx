import { useState } from "react";
import { Database, Play, Plus, RefreshCw, Rows3, Table2 } from "lucide-react";
import { c, mono } from "./theme";
import { dbTables } from "./data";

export default function DatabasePage() {
  const [activeName, setActiveName] = useState(dbTables[0].name);
  const [tab, setTab] = useState<"rows" | "schema">("rows");
  const [sql, setSql] = useState("select * from links order by clicks desc limit 5;");
  const [ran, setRan] = useState<{ ms: number; count: number } | null>(null);

  const table = dbTables.find((t) => t.name === activeName)!;

  const run = () => {
    setRan({ ms: Math.round(4 + Math.random() * 22), count: table.data.length });
    setTab("rows");
  };

  return (
    <div className="flex h-full min-h-0" style={{ backgroundColor: c.bg }}>
      {/* tables list */}
      <div
        className="flex-shrink-0 overflow-y-auto"
        style={{ width: 150, borderRight: `1px solid ${c.border}`, backgroundColor: c.sidebar }}
      >
        <div className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: c.faint }}>
          <Database size={11} /> tailspin_prod
        </div>
        <div className="px-2.5 pb-2 text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
          postgres 16 · us-west
        </div>
        {dbTables.map((t) => {
          const active = t.name === activeName;
          return (
            <button
              key={t.name}
              onClick={() => setActiveName(t.name)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] transition-colors"
              style={{
                color: active ? c.text : c.muted,
                backgroundColor: active ? c.sidebarActive : "transparent",
              }}
              onMouseEnter={(e) => !active && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => !active && (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Table2 size={11} color={c.faint} />
              <span className="truncate" style={{ fontFamily: mono }}>{t.name}</span>
              <span className="ml-auto text-[9.5px]" style={{ color: c.dim }}>{t.rows}</span>
            </button>
          );
        })}
        <button
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 mt-1 text-[11.5px]"
          style={{ color: c.faint }}
        >
          <Plus size={11} /> New table
        </button>
      </div>

      {/* main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* query bar */}
        <div className="p-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: c.input, border: `1px solid ${c.border}` }}
          >
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={2}
              spellCheck={false}
              className="w-full px-2.5 py-2 text-[11.5px] bg-transparent outline-none resize-none"
              style={{ color: c.text, fontFamily: mono }}
            />
            <div className="flex items-center gap-2 px-2 py-1.5" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
              <button
                onClick={run}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                style={{ backgroundColor: c.chipHover, color: c.text }}
              >
                <Play size={10} /> Run
              </button>
              <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>⌘⏎</span>
              {ran && (
                <span className="text-[10.5px]" style={{ color: c.muted, fontFamily: mono }}>
                  {ran.count} rows · {ran.ms} ms
                </span>
              )}
              <button className="ml-auto p-1 rounded-md" style={{ color: c.muted }}>
                <RefreshCw size={11} />
              </button>
            </div>
          </div>
        </div>

        {/* table header */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <Rows3 size={12} color={c.faint} />
          <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>{table.name}</span>
          <span className="text-[10.5px]" style={{ color: c.faint }}>{table.rows} rows · {table.size}</span>
          <div className="ml-auto flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
            {(["rows", "schema"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-2 py-0.5 rounded-md text-[11px] capitalize"
                style={{ backgroundColor: tab === t ? c.chipHover : "transparent", color: tab === t ? c.text : c.muted }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto">
          {tab === "rows" ? (
            <table className="w-full text-[11px]" style={{ fontFamily: mono, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {table.columns.map((col) => (
                    <th
                      key={col.name}
                      className="text-left px-2.5 py-1.5 font-medium sticky top-0"
                      style={{ color: c.muted, backgroundColor: c.bgSubtle, borderBottom: `1px solid ${c.border}` }}
                    >
                      {col.name}
                      <span className="ml-1 text-[9px]" style={{ color: c.dim }}>{col.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.data.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.03]">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-2.5 py-1.5 truncate max-w-[220px]"
                        style={{ color: j === 0 ? c.text : c.muted, borderBottom: `1px solid ${c.borderSoft}` }}
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-3 flex flex-col gap-1.5">
              {table.columns.map((col) => (
                <div
                  key={col.name}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px]"
                  style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}
                >
                  <span style={{ color: c.text }}>{col.name}</span>
                  <span style={{ color: c.muted }}>{col.type}</span>
                  {col.pk && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[9.5px]" style={{ backgroundColor: c.chipHover, color: c.muted }}>
                      PRIMARY KEY
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
