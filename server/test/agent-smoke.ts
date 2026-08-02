// server/test/agent-smoke.ts — end-to-end smoke test of the rewritten agent loop
// against the REAL qwen3.7-max model API. Creates a throwaway thread, injects a
// direct model caller (bypassing usage/balance enforcement), and asserts:
//   1. native tool_calls are executed and a "tool" block is produced
//   2. the model's reasoning surfaces as a "thinking" block
//   3. ask-mode write tools park on a "permission" block (allow/deny)
//   4. after allowing, the tool runs and the loop continues
// Run: npx tsx test/agent-smoke.ts
import "dotenv/config";
import pool from "../src/db.js";
import { v4 as uuid } from "uuid";
import { loadConfig } from "../src/config.js";
import { AgentLoop, setModelCaller, type ToolDef } from "../src/services/agent-loop.js";

const cfg = loadConfig();
const BASE = cfg.models.base_url;
const KEY = cfg.models.api_key;

// Direct model caller (no usage accounting) so the test is isolated from balance.
const directCall: any = async (req: any) => {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: req.model, messages: req.messages, tools: req.tools, tool_choice: req.tool_choice, temperature: req.temperature, max_tokens: req.max_tokens }),
  });
  if (!r.ok) throw new Error(`model API ${r.status}: ${await r.text()}`);
  return await r.json();
};
setModelCaller(directCall);

function log(m: string) { console.log(m); }

async function setup() {
  const uid = `t-${uuid().slice(0, 8)}`;
  const pid = `prj-${uuid().slice(0, 8)}`;
  const tid = `th-${uuid().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO users (id, github_id, username, display_name, email, balance)
     VALUES ($1, $2, $3, $3, $3||'@test.local', 1000)`,
    [uid, Math.floor(Math.random() * 1e9), uid]
  );
  await pool.query(
    `INSERT INTO projects (id, user_id, name, source, category, stack, glyph, color)
     VALUES ($1, $2, 'smoke', 'local', 'Product', '[]', 'SM', '#1A1D28')`,
    [pid, uid]
  );
  await pool.query(
    `INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch)
     VALUES ($1, $2, $3, 'smoke', 'running', 'agent', 'qwen3.7-max', 'smoke')`,
    [tid, pid, uid]
  );
  return { uid, pid, tid };
}

async function blocks(tid: string) {
  const r = await pool.query(`SELECT kind, data FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`, [tid]);
  return r.rows.map((row: any) => ({ kind: row.kind, ...(typeof row.data === "string" ? JSON.parse(row.data) : row.data) }));
}

async function cleanup(tid: string, pid: string, uid: string) {
  await pool.query(`DELETE FROM threads WHERE id = $1`, [tid]);
  await pool.query(`DELETE FROM projects WHERE id = $1`, [pid]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [uid]);
}

async function main() {
  const { uid, pid, tid } = await setup();
  log(`\n=== smoke test · thread ${tid} · qwen3.7-max ===\n`);

  // Fake tools (no real sandbox needed): Ls lists a fixed dir, Write is gated.
  const tools: ToolDef[] = [
    {
      name: "Ls",
      description: "List files in a directory.",
      schema: { type: "object", properties: { path: { type: "string" } } },
      execute: async () => "README.md\nsrc/\npackage.json\n",
    },
    {
      name: "Write",
      description: "Write content to a file. Requires user approval.",
      schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      permission: true,
      execute: async (a) => `Wrote ${a.content.length} bytes to ${a.path}`,
    },
  ];

  let pass = 0, fail = 0;
  const assert = (name: string, cond: boolean, extra = "") => {
    if (cond) { pass++; log(`  ✓ ${name}`); } else { fail++; log(`  ✗ ${name} ${extra}`); }
  };

  // ── Test 1: read-only turn executes a native tool call ──
  log("Test 1: read-only task (list files) drives a native Ls tool call");
  {
    const loop = new AgentLoop({ userId: uid, threadId: tid, modelId: "qwen3.7-max", goal: "List the files in the current directory using the Ls tool, then tell me what you saw.", tools, maxSteps: 4 });
    const avail = loop.getAvailableTools();
    let out: any = "continue";
    let steps = 0;
    while ((out === "continue" || out === "wait_permission") && steps < 6) {
      const s = loop.nextStep();
      out = await loop.step(s, avail);
      steps++;
      if (out === "wait_permission") {
        // shouldn't happen for Ls, but resolve just in case
        if (loop.pending) { (loop as any).pendingCall.resolution = "allow"; }
      }
    }
    const bs = await blocks(tid);
    const hasThinking = bs.some((b) => b.kind === "thinking");
    const hasTool = bs.some((b) => b.kind === "tool" && b.tool === "Ls");
    const hasText = bs.some((b) => b.kind === "text");
    assert("produced a thinking block (real reasoning)", hasThinking);
    assert("executed the Ls tool (tool block)", hasTool);
    assert("produced a final text answer", hasText);
    assert("loop completed", loop.getStatus() === "completed", `status=${loop.getStatus()}`);
    log(`    blocks: ${bs.map((b) => b.kind).join(", ")}`);
  }

  // ── Test 2: ask-mode write tool parks on a permission block ──
  log("\nTest 2: write task in ask mode parks on allow/deny, then runs after allow");
  {
    // fresh thread for isolation
    const tid2 = `th-${uuid().slice(0, 8)}`;
    await pool.query(`INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch) VALUES ($1, $2, $3, 'smoke2', 'running', 'ask', 'qwen3.7-max', 'smoke')`, [tid2, pid, uid]);

    // Rebuild tools with permission gating ON (simulating ask mode buildTools).
    const askTools: ToolDef[] = tools.map((t) => t.name === "Write" ? { ...t, permission: true } : t);
    const loop = new AgentLoop({ userId: uid, threadId: tid2, modelId: "qwen3.7-max", goal: "Create a file called hello.txt containing the text 'hi there' using the Write tool.", tools: askTools, maxSteps: 4 });
    const avail = loop.getAvailableTools();
    const s1 = loop.nextStep();
    const o1 = await loop.step(s1, avail);
    const bs1 = await blocks(tid2);
    const hasPending = bs1.some((b) => b.kind === "permission" && b.resolved === "pending");
    assert("parked on a pending permission block", o1 === "wait_permission" && hasPending, `outcome=${o1}`);
    assert("did NOT run Write yet", !bs1.some((b) => b.kind === "tool" && b.tool === "Write"));

    // Simulate user clicking Allow: set resolution, then continue.
    if (loop.pending) { (loop as any).pendingCall.resolution = "allow"; }
    const s2 = loop.nextStep();
    const o2 = await loop.step(s2, avail);
    const bs2 = await blocks(tid2);
    assert("ran Write after allow", bs2.some((b) => b.kind === "tool" && b.tool === "Write"), `blocks=${bs2.map((b) =>b.kind).join(",")}`);

    await pool.query(`DELETE FROM thread_blocks WHERE thread_id = $1`, [tid2]);
    await pool.query(`DELETE FROM threads WHERE id = $1`, [tid2]);
  }

  // ── Test 3: plain greeting does NOT spin the tool loop ──
  // (AgentService.runStep short-circuit is in agent.ts; here we just confirm the
  //  loop, when asked a trivial question with no tool call, completes with text.)
  log("\nTest 3: trivial question resolves as a text answer (no tool noise)");
  {
    const tid3 = `th-${uuid().slice(0, 8)}`;
    await pool.query(`INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch) VALUES ($1, $2, $3, 'smoke3', 'running', 'ask', 'qwen3.7-max', 'smoke')`, [tid3, pid, uid]);
    const loop = new AgentLoop({ userId: uid, threadId: tid3, modelId: "qwen3.7-max", goal: "Say hello back to me in one short sentence.", tools, maxSteps: 2 });
    const s = loop.nextStep();
    await loop.step(s, loop.getAvailableTools());
    const bs = await blocks(tid3);
    assert("produced a text answer for a greeting", bs.some((b) => b.kind === "text"), `blocks=${bs.map((b)=>b.kind).join(",")}`);
    await pool.query(`DELETE FROM thread_blocks WHERE thread_id = $1`, [tid3]);
    await pool.query(`DELETE FROM threads WHERE id = $1`, [tid3]);
  }

  log(`\n=== result: ${pass} passed, ${fail} failed ===\n`);
  await cleanup(tid, pid, uid);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error("SMOKE TEST CRASHED:", e); try { await pool.end(); } catch {} process.exit(2); });
