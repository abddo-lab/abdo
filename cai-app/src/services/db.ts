/**
 * IndexedDB Persistence — per-user isolated storage
 */

const DB_NAME = "cai-agent";
const DB_VERSION = 3;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("threads")) {
        const ts = db.createObjectStore("threads", { keyPath: "id" });
        ts.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("messages")) {
        const ms = db.createObjectStore("messages", { keyPath: "id" });
        ms.createIndex("threadId", "threadId");
      }
      if (!db.objectStoreNames.contains("memories")) {
        db.createObjectStore("memories", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("usage")) {
        const us = db.createObjectStore("usage", { keyPath: "id" });
        us.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("github_files")) {
        const gf = db.createObjectStore("github_files", { keyPath: "path" });
        gf.createIndex("repo", "repo");
      }
      if (!db.objectStoreNames.contains("n8n_instances")) {
        db.createObjectStore("n8n_instances", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("workflows")) {
        const ws = db.createObjectStore("workflows", { keyPath: "id" });
        ws.createIndex("instanceId", "instanceId");
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

async function txGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function txGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function txGetByIndex<T>(store: string, idx: string, key: string | number): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).index(idx).getAll(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function txPut<T>(store: string, val: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(val);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function txDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function txClear(store: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Thread ───
export interface ThreadRecord {
  id: string;
  title: string;
  repo: string;
  branch: string;
  model: string;
  mode: string;
  effort: string;
  createdAt: number;
  updatedAt: number;
}
export const threadsDB = {
  get: (id: string) => txGet<ThreadRecord>("threads", id),
  getAll: () => txGetAll<ThreadRecord>("threads"),
  put: (t: ThreadRecord) => txPut("threads", t),
  delete: (id: string) => txDelete("threads", id),
};

// ─── Message ───
export interface MessageRecord {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  createdAt: number;
}
export const messagesDB = {
  getByThread: (threadId: string) => txGetByIndex<MessageRecord>("messages", "threadId", threadId),
  put: (m: MessageRecord) => txPut("messages", m),
  clearThread: async (threadId: string) => {
    const msgs = await txGetByIndex<MessageRecord>("messages", "threadId", threadId);
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("messages", "readwrite");
      const store = tx.objectStore("messages");
      for (const m of msgs) store.delete(m.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// ─── Memory ───
export interface MemoryRecord {
  id: string;
  scope: "user" | "thread";
  threadId?: string;
  content: string;
  source?: string;
  createdAt: number;
}
export const memoriesDB = {
  getAll: () => txGetAll<MemoryRecord>("memories"),
  put: (m: MemoryRecord) => txPut("memories", m),
  delete: (id: string) => txDelete("memories", id),
};

// ─── Usage ───
export interface UsageRecord {
  id: string;
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  githubUser: string;
}
export const usageDB = {
  getAll: () => txGetAll<UsageRecord>("usage"),
  put: (u: UsageRecord) => txPut("usage", u),
  clear: () => txClear("usage"),
  addUsage: async (model: string, inTok: number, outTok: number, cost: number, githubUser: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const all = await txGetAll<UsageRecord>("usage");
    const match = all.find((r) => r.date === today && r.model === model && r.githubUser === githubUser);
    if (match) {
      match.inputTokens += inTok;
      match.outputTokens += outTok;
      match.cost += cost;
      await txPut("usage", match);
    } else {
      await txPut("usage", { id: `u-${today}-${model}-${Date.now()}`, date: today, model, inputTokens: inTok, outputTokens: outTok, cost, githubUser });
    }
  },
  getTodayCost: async (githubUser: string): Promise<number> => {
    const today = new Date().toISOString().slice(0, 10);
    const all = await txGetAll<UsageRecord>("usage");
    return all.filter((r) => r.date === today && r.githubUser === githubUser).reduce((s, r) => s + r.cost, 0);
  },
};

// ─── Settings ───
export const settingsDB = {
  get: async <T>(key: string, fallback: T): Promise<T> => {
    const rec = await txGet<{ key: string; value: unknown }>("settings", key);
    return (rec?.value as T) ?? fallback;
  },
  set: (key: string, value: unknown) => txPut("settings", { key, value }),
};

// ─── GitHub Files Cache ───
export interface CachedFile {
  path: string;
  repo: string;
  content: string;
  sha: string;
  fetchedAt: number;
}
export const filesDB = {
  get: (path: string) => txGet<CachedFile>("github_files", path),
  getByRepo: (repo: string) => txGetByIndex<CachedFile>("github_files", "repo", repo),
  put: (f: CachedFile) => txPut("github_files", f),
  clear: () => txClear("github_files"),
};

// ─── N8N Instances ───
export interface N8nInstanceRecord {
  id: string;
  userId: string;
  workflowName: string;
  slug: string;
  status: "creating" | "running" | "stopped" | "error";
  port: number;
  apiUrl: string;
  apiKey: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
  error: string | null;
}
export const n8nInstancesDB = {
  get: (id: string) => txGet<N8nInstanceRecord>("n8n_instances", id),
  getAll: () => txGetAll<N8nInstanceRecord>("n8n_instances"),
  getByUser: async (userId: string): Promise<N8nInstanceRecord | null> => {
    const all = await txGetAll<N8nInstanceRecord>("n8n_instances");
    return all.find((i) => i.userId === userId) ?? null;
  },
  put: (instance: N8nInstanceRecord) => txPut("n8n_instances", instance),
  delete: (id: string) => txDelete("n8n_instances", id),
};

// ─── Workflows ───
export interface WorkflowRecord {
  id: string;
  instanceId: string;
  name: string;
  slug: string;
  description: string;
  n8nWorkflowId: string | null;
  status: "draft" | "active" | "paused" | "error";
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  runCount: number;
  error: string | null;
}
export const workflowsDB = {
  get: (id: string) => txGet<WorkflowRecord>("workflows", id),
  getAll: () => txGetAll<WorkflowRecord>("workflows"),
  getByInstance: (instanceId: string) => txGetByIndex<WorkflowRecord>("workflows", "instanceId", instanceId),
  put: (workflow: WorkflowRecord) => txPut("workflows", workflow),
  delete: (id: string) => txDelete("workflows", id),
};
