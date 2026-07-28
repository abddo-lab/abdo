import { useState, useEffect, useCallback } from "react";
import {
  Plus, Loader2, Zap, Trash2, XCircle, Search, ExternalLink, Rocket,
  Bot, Send, Square, ChevronRight, RotateCcw, FileJson, Upload, ZoomIn, ZoomOut, ChevronDown, Filter,
  Globe, Lock, Copy, Check, Eye, EyeOff, Settings, Play, Pause, RefreshCw
} from "lucide-react";
import { c, mono } from "./theme";
import { useAuth } from "./auth";
import {
  n8nManager, workflowManager, n8nAi, n8nBranding,
  type N8nInstance, type Workflow
} from "../services/n8n-manager";

// ─── Slug display component ───
function SlugDisplay({ slug, instanceUrl }: { slug: string; instanceUrl: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${instanceUrl}/workflow/${slug}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
      <Globe size={10} color={c.dim} />
      <span className="text-[10px] truncate" style={{ color: c.muted, fontFamily: mono }}>{slug}</span>
      <button onClick={copyUrl} className="p-0.5 rounded hover:bg-white/5" title="Copy URL">
        {copied ? <Check size={10} color="#4ade80" /> : <Copy size={10} color={c.dim} />}
      </button>
    </div>
  );
}

// ─── Instance Status Card ───
function InstanceCard({ instance, onRefresh, onDelete }: {
  instance: N8nInstance;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const toggleStatus = async () => {
    setLoading(true);
    if (instance.status === "running") {
      await n8nManager.stopInstance(instance.id);
    } else {
      await n8nManager.startInstance(instance);
    }
    onRefresh();
    setLoading(false);
  };

  return (
    <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{
          backgroundColor: instance.status === "running" ? "#4ade80" :
            instance.status === "error" ? "#f87171" : c.dim
        }} />
        <span className="text-[12px] font-medium flex-1" style={{ color: c.text }}>{instance.workflowName}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
          backgroundColor: instance.status === "running" ? "rgba(74,222,128,.1)" : c.chip,
          color: instance.status === "running" ? "#4ade80" : c.muted,
          fontFamily: mono
        }}>
          {instance.status}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] mb-2" style={{ color: c.dim }}>
        <span>Port: {instance.port}</span>
        <span>•</span>
        <span>{instance.slug}</span>
      </div>

      {instance.apiUrl && (
        <a
          href={instance.apiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] mb-2 hover:underline"
          style={{ color: c.accent }}
        >
          <ExternalLink size={10} /> Open N8N Editor
        </a>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={toggleStatus}
          disabled={loading || instance.status === "creating"}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
          style={{
            backgroundColor: instance.status === "running" ? "rgba(248,113,113,.1)" : "rgba(74,222,128,.1)",
            color: instance.status === "running" ? "#f87171" : "#4ade80",
            border: `1px solid ${instance.status === "running" ? "rgba(248,113,113,.2)" : "rgba(74,222,128,.2)"}`
          }}
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> :
            instance.status === "running" ? <Square size={10} /> : <Play size={10} />}
          {instance.status === "running" ? "Stop" : "Start"}
        </button>

        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
          style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  );
}

// ─── Workflow Card ───
function WorkflowCard({ workflow, instance, onOpen, onDelete }: {
  workflow: Workflow;
  instance: N8nInstance;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const publicUrl = workflowManager.getWorkflowUrl(instance, workflow);

  return (
    <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{
          backgroundColor: workflow.status === "active" ? "#4ade80" :
            workflow.status === "error" ? "#f87171" : c.dim
        }} />
        <span className="text-[12px] font-medium flex-1" style={{ color: c.text }}>{workflow.name}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{
          backgroundColor: workflow.status === "active" ? "rgba(74,222,128,.1)" : c.chip,
          color: workflow.status === "active" ? "#4ade80" : c.muted,
          fontFamily: mono
        }}>
          {workflow.status}
        </span>
      </div>

      {workflow.description && (
        <div className="text-[10px] mb-2 line-clamp-2" style={{ color: c.muted }}>{workflow.description}</div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <SlugDisplay slug={workflow.slug} instanceUrl={instance.apiUrl} />
      </div>

      <div className="flex items-center gap-2 text-[9px] mb-2" style={{ color: c.dim }}>
        <span>Runs: {workflow.runCount}</span>
        {workflow.lastRunAt && (
          <span>Last: {new Date(workflow.lastRunAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onOpen}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
          style={{ backgroundColor: "rgba(74,222,128,.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}
        >
          <ExternalLink size={10} /> Open
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
          style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Create Instance Modal ───
function CreateInstanceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    await onCreate(name.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="popIn rounded-2xl overflow-hidden" style={{
        width: 480,
        backgroundColor: "rgba(12,12,12,0.98)",
        border: `1px solid ${c.borderStrong}`,
        boxShadow: c.shadowPop
      }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>New Instance</div>
          <h2 className="text-[16px] font-semibold mt-0.5" style={{ color: c.text }}>Create N8N Workflow Instance</h2>
        </div>
        <div className="px-5 py-4">
          <label className="text-[10px] uppercase mb-1.5 block" style={{ color: c.faint }}>Workflow Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. GitHub PR Automation..."
            className="w-full text-[13px] px-3 py-2 rounded-lg outline-none"
            style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="text-[10px] mt-2" style={{ color: c.dim }}>
            This name will become your public URL: /workflow/{n8nManager.createSlug(name || "my-workflow")}
          </div>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${c.border}`, backgroundColor: "rgba(0,0,0,0.35)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: c.muted }}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
            style={{ backgroundColor: name.trim() ? c.accent : c.chip, color: name.trim() ? "#000" : c.dim }}
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create Instance
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Assistant Panel ───
function AiAssistantPanel({ instance, workflowContext }: {
  instance: N8nInstance;
  workflowContext?: { nodes: string[]; connections: string[] };
}) {
  const { github } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading || !github.user) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const response = await n8nAi.chat(github.user.login, [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMsg },
      ], workflowContext);

      setMessages((m) => [...m, { role: "assistant", content: response }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : String(err)}` }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
        <Bot size={13} color={c.accent} />
        <span className="text-[11px] font-medium" style={{ color: c.text }}>Workflow Assistant</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot size={16} className="mx-auto mb-1.5" style={{ color: c.dim }} />
            <div className="text-[10.5px]" style={{ color: c.muted }}>Ask me to build workflows.</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`rounded-lg p-2 text-[10.5px] leading-relaxed ${msg.role === "user" ? "ml-4" : "mr-4"}`}
            style={{ backgroundColor: msg.role === "user" ? c.chip : c.panel, border: `1px solid ${c.borderSoft}`, color: c.text }}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="rounded-lg p-2 mr-4 text-[10.5px]" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, color: c.muted }}>
            <Loader2 size={9} className="animate-spin inline" /> Thinking...
          </div>
        )}
      </div>

      <div className="p-2.5 flex-shrink-0" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Describe a workflow..."
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[10.5px] outline-none"
            style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: input.trim() ? c.accent : c.chip, color: input.trim() ? "#000" : c.dim }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function WorkflowsPanel() {
  const { github } = useAuth();

  const [instance, setInstance] = useState<N8nInstance | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load instance and workflows
  const loadData = useCallback(async () => {
    if (!github.user) return;
    setLoading(true);

    const inst = await n8nManager.getUserInstance(github.user.login);
    setInstance(inst);

    if (inst) {
      const wfs = await workflowManager.getWorkflows(inst.id);
      setWorkflows(wfs);
    }

    setLoading(false);
  }, [github.user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Create new instance
  const handleCreateInstance = async (name: string) => {
    if (!github.user) return;
    await n8nManager.createInstance(github.user.login, name);
    await loadData();
  };

  // Create new workflow
  const handleCreateWorkflow = async (name: string, description: string) => {
    if (!instance) return;
    await workflowManager.createWorkflow(instance.id, name, description);
    await loadData();
    setShowCreateWorkflow(false);
  };

  // Delete workflow
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!instance) return;
    await workflowManager.deleteWorkflow(instance.id, workflowId);
    if (selectedWorkflow?.id === workflowId) setSelectedWorkflow(null);
    await loadData();
  };

  // Delete instance
  const handleDeleteInstance = async () => {
    if (!github.user) return;
    await n8nManager.deleteInstance(github.user.login);
    setInstance(null);
    setWorkflows([]);
    setSelectedWorkflow(null);
  };

  // Open workflow in N8N
  const openWorkflow = (workflow: Workflow) => {
    if (!instance) return;
    const url = workflowManager.getWorkflowUrl(instance, workflow);
    window.open(url, "_blank");
  };

  const filteredWorkflows = workflows.filter((wf) =>
    wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wf.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center" style={{ backgroundColor: c.bg }}>
        <Loader2 size={20} className="animate-spin" style={{ color: c.dim }} />
      </div>
    );
  }

  // No instance - show create screen
  if (!instance) {
    return (
      <div className="flex-1 h-full flex items-center justify-center" style={{ backgroundColor: c.bg }}>
        <div className="text-center max-w-md">
          <Zap size={28} className="mx-auto mb-3" style={{ color: c.dim }} />
          <div className="text-[16px] font-semibold mb-1" style={{ color: c.text }}>N8N Workflow Manager</div>
          <div className="text-[12px] mb-5" style={{ color: c.muted }}>
            Create your own N8N workflow instance. Each user gets one instance with full access to all N8N features.
          </div>

          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="text-[11px] font-medium mb-2" style={{ color: c.text }}>Features</div>
            <ul className="text-[10px] space-y-1.5" style={{ color: c.muted }}>
              <li>• Full N8N workflow editor</li>
              <li>• AI assistant connected to our API</li>
              <li>• Custom branded interface</li>
              <li>• Credit-based usage (from your daily limit)</li>
              <li>• Public workflow URLs</li>
            </ul>
          </div>

          <button
            onClick={() => setShowCreateInstance(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium mx-auto"
            style={{ backgroundColor: c.accent, color: "#000" }}
          >
            <Plus size={13} /> Create Your Instance
          </button>
        </div>

        {showCreateInstance && (
          <CreateInstanceModal
            onClose={() => setShowCreateInstance(false)}
            onCreate={handleCreateInstance}
          />
        )}
      </div>
    );
  }

  // Has instance - show workflows
  return (
    <div className="flex-1 h-full flex min-h-0" style={{ backgroundColor: c.bg }}>
      {/* Left sidebar - workflows list */}
      <div className="w-64 flex-shrink-0 flex flex-col" style={{ borderRight: `1px solid ${c.border}` }}>
        {/* Instance info */}
        <div className="p-3" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{
              backgroundColor: instance.status === "running" ? "#4ade80" : c.dim
            }} />
            <span className="text-[12px] font-medium" style={{ color: c.text }}>{instance.workflowName}</span>
          </div>
          <InstanceCard instance={instance} onRefresh={loadData} onDelete={handleDeleteInstance} />
        </div>

        {/* Search and create */}
        <div className="p-3" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-1.5 px-2 rounded-lg mb-2" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
            <Search size={11} color={c.dim} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-full bg-transparent text-[11px] py-1.5 outline-none"
              style={{ color: c.text }}
            />
          </div>
          <button
            onClick={() => setShowCreateWorkflow(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px]"
            style={{ backgroundColor: c.accent, color: "#000" }}
          >
            <Plus size={12} /> New Workflow
          </button>
        </div>

        {/* Workflows list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-8 text-[11px]" style={{ color: c.dim }}>No workflows yet.</div>
          ) : (
            filteredWorkflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                instance={instance}
                onOpen={() => openWorkflow(wf)}
                onDelete={() => handleDeleteWorkflow(wf.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Center - workflow details or empty state */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedWorkflow ? (
          <div className="flex-1 flex">
            {/* Workflow details */}
            <div className="flex-1 p-5">
              <h2 className="text-[16px] font-semibold mb-2" style={{ color: c.text }}>{selectedWorkflow.name}</h2>
              {selectedWorkflow.description && (
                <p className="text-[12px] mb-4" style={{ color: c.muted }}>{selectedWorkflow.description}</p>
              )}

              <div className="flex items-center gap-3 mb-4">
                <SlugDisplay slug={selectedWorkflow.slug} instanceUrl={instance.apiUrl} />
                <button
                  onClick={() => openWorkflow(selectedWorkflow)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                  style={{ backgroundColor: "rgba(74,222,128,.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}
                >
                  <ExternalLink size={10} /> Open in N8N
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <div className="text-[10px]" style={{ color: c.dim }}>Status</div>
                  <div className="text-[12px] font-medium" style={{ color: c.text }}>{selectedWorkflow.status}</div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <div className="text-[10px]" style={{ color: c.dim }}>Runs</div>
                  <div className="text-[12px] font-medium" style={{ color: c.text }}>{selectedWorkflow.runCount}</div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <div className="text-[10px]" style={{ color: c.dim }}>Created</div>
                  <div className="text-[12px] font-medium" style={{ color: c.text }}>{new Date(selectedWorkflow.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="w-72 flex-shrink-0" style={{ borderLeft: `1px solid ${c.border}` }}>
              <AiAssistantPanel instance={instance} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <Zap size={28} className="mx-auto mb-3" style={{ color: c.dim }} />
              <div className="text-[16px] font-semibold mb-1" style={{ color: c.text }}>N8N Workflows</div>
              <div className="text-[12px] mb-5" style={{ color: c.muted }}>
                Select a workflow to view details, or create a new one.
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <Globe size={16} className="mx-auto mb-1.5" style={{ color: c.accent }} />
                  <div className="text-[11px] font-medium" style={{ color: c.text }}>Public URLs</div>
                  <div className="text-[9px]" style={{ color: c.dim }}>Each workflow gets a public URL</div>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <Bot size={16} className="mx-auto mb-1.5" style={{ color: c.accent }} />
                  <div className="text-[11px] font-medium" style={{ color: c.text }}>AI Assistant</div>
                  <div className="text-[9px]" style={{ color: c.dim }}>Connected to our API</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create workflow modal */}
      {showCreateWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowCreateWorkflow(false)}>
          <div className="popIn rounded-2xl overflow-hidden" style={{
            width: 480,
            backgroundColor: "rgba(12,12,12,0.98)",
            border: `1px solid ${c.borderStrong}`,
            boxShadow: c.shadowPop
          }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>New Workflow</div>
              <h2 className="text-[16px] font-semibold mt-0.5" style={{ color: c.text }}>Create Workflow</h2>
            </div>
            <CreateWorkflowForm onSubmit={handleCreateWorkflow} onCancel={() => setShowCreateWorkflow(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Workflow Form ───
function CreateWorkflowForm({ onSubmit, onCancel }: {
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <>
      <div className="px-5 py-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase mb-1.5 block" style={{ color: c.faint }}>Workflow Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. GitHub PR Auto-Review..."
            className="w-full text-[13px] px-3 py-2 rounded-lg outline-none"
            style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
          />
          <div className="text-[10px] mt-1.5" style={{ color: c.dim }}>
            URL: /workflow/{n8nManager.createSlug(name || "my-workflow")}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase mb-1.5 block" style={{ color: c.faint }}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this workflow do?"
            className="w-full text-[12px] px-3 py-2 rounded-lg outline-none resize-none"
            style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
          />
        </div>
      </div>
      <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${c.border}`, backgroundColor: "rgba(0,0,0,0.35)" }}>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: c.muted }}>Cancel</button>
        <button
          onClick={() => onSubmit(name, description)}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
          style={{ backgroundColor: name.trim() ? c.accent : c.chip, color: name.trim() ? "#000" : c.dim }}
        >
          <Plus size={12} /> Create
        </button>
      </div>
    </>
  );
}
