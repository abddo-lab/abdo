import { useCallback, useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { Badge, Btn } from "./ui";
import * as api from "../api";

interface Node {
  id: string;
  name: string;
  status: string;
  region: string | null;
  cpu_cores: number;
  memory_gb: string | number;
  storage_gb: string | number;
  version: string | null;
  stats: { load?: number };
  history: { cpu?: number; mem?: number; disk?: number; load?: number; t: number }[];
  online: boolean;
}

function Chart({ data, color = "#4b6ef7" }: { data: number[]; color?: string }) {
  if (!data.length) return <div className="h-12" />;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
      const y = 42 - (Math.min(v, max) / max) * 40;
      return { x, y };
    })
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 44" className="h-12 w-full" preserveAspectRatio="none">
      <polygon points={`0,44 ${pts} 100,44`} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function NodeCard({ node, onRemove, onRefresh }: { node: Node; onRemove: (id: string) => void; onRefresh: () => void }) {
  const [series, setSeries] = useState<number[]>([]);
  useEffect(() => {
    api.nodes.stats(node.id).then((s) => {
      setSeries((s.history || []).slice(-40).map((p: any) => Number(p.load ?? p.cpu ?? 0)));
    }).catch(() => {});
  }, [node.id]);
  const last = series[series.length - 1] ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--chrome)] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            node.online ? "bg-[var(--accent-soft)]" : "bg-[var(--panel-2)]"
          )}>
            <Icon name="server" size={16} className={node.online ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--text)]">{node.name}</p>
            <p className="font-mono text-[10px] text-[var(--faint)]">{node.id.slice(0, 8)} · {node.region || "remote"}</p>
          </div>
        </div>
        <Badge tone={node.online ? "accent" : "muted"}>{node.online ? "online" : node.status}</Badge>
      </div>

      <Chart data={series} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[var(--panel)] py-2">
          <p className="text-[16px] font-bold text-[var(--text)]">{node.cpu_cores || 0}</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--faint)]">cores</p>
        </div>
        <div className="rounded-xl bg-[var(--panel)] py-2">
          <p className="text-[16px] font-bold text-[var(--text)]">{Number(node.memory_gb).toFixed(1)}G</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--faint)]">RAM</p>
        </div>
        <div className="rounded-xl bg-[var(--panel)] py-2">
          <p className="text-[16px] font-bold text-[var(--text)]">{String(node.storage_gb)}G</p>
          <p className="text-[9px] uppercase tracking-wide text-[var(--faint)]">disk</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10.5px] text-[var(--muted)]">
        <span>load {last.toFixed(1)}</span>
        <span>{node.version || "agent v1.0"}</span>
      </div>

      <div className="flex gap-2">
        <Btn variant="ghost" className="flex-1" onClick={onRefresh}>Refresh</Btn>
        <Btn variant="ghost" className="flex-1 !text-[var(--red)]" onClick={() => onRemove(node.id)}>Remove</Btn>
      </div>
    </div>
  );
}

function AddNodeCard({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("node-1");
  const [region, setRegion] = useState("us-west");
  const [creating, setCreating] = useState(false);
  const [install, setInstall] = useState<string | null>(null);
  const [copy, setCopy] = useState<string | null>(null);

  const doCreate = async () => {
    setCreating(true);
    try {
      const res = await api.nodes.create({ name, region, storage_gb: 100 });
      setInstall(res.install);
      onAdded();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (install) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--border-2)] bg-[var(--chrome)] p-4">
        <p className="text-[13px] font-semibold text-[var(--text)]">Run this on the server</p>
        <code className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 font-mono text-[10.5px] leading-relaxed text-[var(--text)] break-all">
          {install}
        </code>
        <div className="flex gap-2">
          <Btn variant="ghost" className="flex-1"
            onClick={() => { navigator.clipboard?.writeText(install); setCopy("Copied!"); setTimeout(() => setCopy(null), 1500); }}>
            {copy || "Copy"}
          </Btn>
          <Btn className="flex-1" onClick={() => { setInstall(null); onAdded(); }}>Done</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--border-2)] bg-[var(--chrome)] p-4">
      <p className="text-[13px] font-semibold text-[var(--text)]">Register a new node</p>
      <p className="text-[11.5px] text-[var(--muted)]">
        Runs workflows / n8n on fast, unlimited remote servers. Agent dials OUT over WebSocket — no public IP, no sudo needed.
      </p>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="node name"
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]" />
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="region"
          className="w-[110px] rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]" />
      </div>
      <Btn onClick={doCreate} disabled={creating}>{creating ? "Creating..." : "Create node + installer"}</Btn>
    </div>
  );
}

function HistoryPanel({ history }: { history: { t: number; load?: number; mem?: number }[] }) {
  const cpu = history.map((h) => h.load ?? 0);
  const mem = history.map((h) => h.mem ?? 0);
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--chrome)] p-4">
      <p className="mb-3 text-[12.5px] font-semibold text-[var(--text)]">Live utilization</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-[var(--faint)]"><span>Load / CPU</span><span>{cpu.length ? cpu[cpu.length - 1]?.toFixed(1) : "0"}</span></div>
          <Chart data={cpu} color="#4b6ef7" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-[var(--faint)]"><span>Memory</span><span>{mem.length ? mem[mem.length - 1]?.toFixed(1) : "0"}G</span></div>
          <Chart data={mem} color="#e0a458" />
        </div>
      </div>
    </div>
  );
}

export default function NodesPanel({ onToast }: { onToast: (m: string) => void }) {
  const [nodes, setNodes] = useState<Node[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.nodes.list();
      setNodes(res.nodes || []);
    } catch (e: any) {
      onToast(e.message);
    }
  }, [onToast]);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Remove this node? It will disconnect immediately.")) return;
    await api.nodes.remove(id).catch((e) => onToast(e.message));
    load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[var(--muted)]">
          {nodes ? `${nodes.filter((n) => n.online).length}/${nodes.length} nodes online` : "Loading nodes…"}
        </p>
        <Btn variant="ghost" onClick={load}>Refresh</Btn>
      </div>

      <AddNodeCard onAdded={load} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(nodes || []).map((n) => <NodeCard key={n.id} node={n} onRemove={remove} onRefresh={load} />)}
        {nodes && nodes.length === 0 && (
          <p className="col-span-full pt-6 text-center text-[12.5px] text-[var(--faint)]">
            No nodes registered. Add one to run workflows on unlimited remote servers.
          </p>
        )}
      </div>

      {nodes?.filter((n) => n.online).map((n) => (
        <HistoryPanel key={n.id} history={n.history || []} />
      ))}
    </div>
  );
}