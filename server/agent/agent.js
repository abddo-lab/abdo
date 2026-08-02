#!/usr/bin/env node
// Kiren node agent — connect-back daemon. Dials OUT to the hub via WebSocket.
// No inbound ports, no public IP required. Handles RPC: exec, sandbox, n8n, tunnel.
const http = require("http");
const https = require("https");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const HUB = process.env.HUB;
const TOKEN = process.env.TOKEN;

if (!HUB || !TOKEN) {
  console.error("[kiren-agent] HUB and TOKEN env vars required");
  process.exit(1);
}

const NODE_ID = TOKEN.split(".")[0] || TOKEN.slice(0, 12);
let socket = null;
let frameBuf = Buffer.alloc(0);
let firstRun = true;
let heartbeatTimer = null;

// ── helpers ────────────────────────────────────────────────────
function b64(s) { return Buffer.from(s).toString("base64"); }
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

function exec(cmd, cb) {
  const p = spawn("bash", ["-lc", cmd]);
  let so = "", se = "";
  p.stdout.on("data", (d) => so += d);
  p.stderr.on("data", (d) => se += d);
  p.on("close", (code) => cb(code === 0 ? null : new Error(se || so), so));
  p.on("error", (e) => cb(e, so));
}
function tryExec(cmd) { return new Promise((res) => exec(cmd, (err, so) => res(err ? "" : so.toString()))); }

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn("bash", ["-lc", command], { cwd: cwd || os.homedir() });
    let so = "", se = "";
    const t0 = Date.now();
    p.stdout.on("data", (d) => so += d);
    p.stderr.on("data", (d) => se += d);
    p.on("close", (code) => resolve({ code, stdout: so, stderr: se, duration_ms: Date.now() - t0, success: code === 0 }));
    p.on("error", reject);
  });
}
function runDetached(command) {
  const p = spawn("bash", ["-lc", command], { detached: true, stdio: "ignore" });
  p.unref();
  return Promise.resolve({ ok: true, pid: p.pid });
}
function docker(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args);
    let so = "", se = "";
    p.stdout.on("data", (d) => so += d);
    p.stderr.on("data", (d) => se += d);
    p.on("close", (code) => code === 0 ? resolve({ code, stdout: so, stderr: se, success: true }) : reject(new Error(se || so)));
  });
}
function hasDocker() { return tryExec("docker info >/dev/null 2>&1 && echo yes || echo no").then((r) => r.trim() === "yes"); }

// ── WebSocket framing (dependency-free) ────────────────────────
function buildFrame(obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  let header;
  const len = payload.length;
  // Client → server frames MUST be masked (RFC 6455 §5.3)
  if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  const mask = require("crypto").randomBytes(4);
  const masked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
  if (socket) socket.write(Buffer.concat([header, mask, masked]));
}

function pumpFrames() {
  while (frameBuf.length >= 2) {
    const b0 = frameBuf[0], b1 = frameBuf[1];
    const opcode = b0 & 0x0f;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) { if (frameBuf.length < 4) return; len = frameBuf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (frameBuf.length < 10) return; len = Number(frameBuf.readBigUInt64BE(2)); off = 10; }
    const masked = (b1 & 0x80) === 0x80;
    const maskLen = masked ? 4 : 0;
    if (frameBuf.length < off + maskLen + len) return;
    let payload = frameBuf.slice(off + maskLen, off + maskLen + len);
    if (masked) { const mask = frameBuf.slice(off, off + 4); payload = Buffer.from(payload.map((b, i) => b ^ mask[i % 4])); }
    frameBuf = frameBuf.slice(off + maskLen + len);
    if (opcode === 1 || opcode === 2) { let msg; try { msg = JSON.parse(payload.toString()); } catch { continue; } handleMessage(msg); }
    else if (opcode === 8) { socket?.end(); socket = null; scheduleReconnect(); return; }
  }
}

function handleSocket(sock) {
  socket = sock;
  console.log("[kiren-agent] connected to hub");
  sock.on("data", (chunk) => { frameBuf = Buffer.concat([frameBuf, chunk]); pumpFrames(); });
  sock.on("close", () => { socket = null; scheduleReconnect(); });
  sock.on("error", () => { socket = null; scheduleReconnect(); });
}

function connect() {
  const url = new URL(HUB);
  const httpUrl = new URL(url.href);
  if (httpUrl.protocol === "ws:") httpUrl.protocol = "http:";
  else if (httpUrl.protocol === "wss:") httpUrl.protocol = "https:";
  const mod = httpUrl.protocol === "https:" ? https : http;
  const key = b64(require("crypto").randomBytes(16));
  const req = mod.request(httpUrl, {
    method: "GET",
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Key": key,
      "Sec-WebSocket-Version": "13",
      "X-Node-Token": TOKEN,
    },
  });
  let upgraded = false;
  req.on("upgrade", (res, socketStream, head) => { upgraded = true; handleSocket(socketStream); if (head.length) { frameBuf = Buffer.concat([frameBuf, head]); pumpFrames(); } });
  req.on("response", (res) => { console.error("[kiren-agent] HTTP response", res.statusCode); req.destroy(); });
  req.on("error", (e) => { console.error("[kiren-agent] connect error:", e.message); scheduleReconnect(); });
  req.setTimeout(30000, () => { if (!upgraded) req.destroy(); });
  req.end();
}

function scheduleReconnect() {
  if (socket) return;
  setTimeout(connect, firstRun ? 1000 : 5000);
  firstRun = false;
}

// ── message handling ───────────────────────────────────────────
async function handleMessage(msg) {
  if (msg.type === "node:hello") {
    if (!heartbeatTimer) { heartbeatTimer = setInterval(sendHeartbeat, 20000); }
    sendHeartbeat();
    return;
  }
  if (msg.type === "rpc" && msg.method === "agent:heartbeat") return;
  if (msg.type === "rpc") {
    try {
      const result = await dispatch(msg.method, msg.params || {});
      buildFrame({ type: "rpc:reply", id: msg.id, result });
    } catch (e) {
      buildFrame({ type: "rpc:reply", id: msg.id, error: String((e && e.message) || e) });
    }
  }
}

async function sendHeartbeat() {
  try {
    const stats = await collectStats();
    buildFrame({ type: "rpc", id: "hb-" + Date.now(), method: "agent:heartbeat", params: { node_id: NODE_ID, stats } });
  } catch {}
}

async function collectStats() {
  const out = {};
  out.cpu_cores = parseInt((await tryExec("nproc")) || "0");
  const mem = await tryExec("awk '/MemTotal/{print $2}' /proc/meminfo");
  out.memory_gb = parseFloat(((parseInt(mem || "0") / 1024 / 1024)).toFixed(2)) || 0;
  const df = await tryExec("df -m / | awk 'NR==2{print $2}'");
  out.disk_gb = parseFloat(((parseInt(df || "0") / 1024)).toFixed(2)) || 0;
  out.load = parseFloat((await tryExec("cat /proc/loadavg | cut -d' ' -f1")) || "0") || 0;
  out.version = "1.0.0";
  out.capabilities = { docker: await hasDocker() };
  return out;
}

// ── RPC dispatch ───────────────────────────────────────────────
async function dispatch(method, params) {
  switch (method) {
    case "exec": return await runCommand(params.command, params.cwd);
    case "exec_detached": return await runDetached(params.command);
    case "sandbox:list": return await docker(["ps", "-a", "--format", "json"]);
    case "sandbox:create": return await createSandbox(params);
    case "sandbox:start": return await docker(["start", params.sandbox_id]);
    case "sandbox:stop": return await docker(["stop", params.sandbox_id]);
    case "sandbox:delete": return await docker(["rm", "-f", params.sandbox_id]);
    case "sandbox:stats": return await docker(["stats", params.sandbox_id, "--no-stream"]);
    case "sandbox:exec": return await runCommand("docker exec " + shq(params.sandbox_id) + " " + shq(params.command), params.cwd);
    case "sandbox:exec_detached": return await runDetached("docker exec -d " + shq(params.sandbox_id) + " " + shq(params.command));
    case "sandbox:open_tunnel": return await openTunnel({ target: params.target, container: params.sandbox_id, kind: params.kind || "ssh" });
    case "n8n:deploy": return await deployN8n(params);
    case "tunnel:open": return await openTunnel(params);
    default: throw new Error("Unknown RPC: " + method);
  }
}

async function createSandbox(params) {
  const name = "kiren-node-" + (params.name || "sb-" + Date.now());
  const opts = ["run", "-d", "--name", name, "--restart", "unless-stopped"];
  const mem = params.memory_gb || 2;
  opts.push("--memory", mem + "g", "--memory-swap", String(mem + (params.swap_gb || 2)) + "g");
  if (params.storage_gb) opts.push("--storage-opt", "size=" + params.storage_gb + "g");
  opts.push(params.image || "node:20-bookworm-slim", "sleep", "infinity");
  const res = await docker(opts);
  return { sandbox_id: name, container_id: name, ...res };
}

async function deployN8n(params) {
  const name = "kiren-n8n-" + (params.name || "main");
  const dir = os.homedir() + "/kiren-n8n/" + name;
  const port = params.port || 5678;
  await runCommand("mkdir -p " + dir);
  const compose = [
    "services:",
    "  n8n:",
    "    image: n8nio/n8n:latest",
    "    restart: unless-stopped",
    "    environment:",
    "      - N8N_PORT=" + port,
    (params.public_url ? "      - WEBHOOK_URL=" + params.public_url : ""),
    "    ports:",
    '      - "127.0.0.1:' + port + ':' + port + '"',
    "    volumes:",
    "      - " + dir + ":/home/node/.n8n",
    "",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(dir + "/docker-compose.yml", compose);
  await runCommand("cd " + dir + " && docker compose up -d");
  return { name, port };
}

async function openTunnel(params) {
  // cloudflared makes an outbound tunnel — no inbound ports on the node.
  // Retry up to 3 times since trycloudflare registration is occasionally flaky.
  const target = params.target;
  const name = "tun-" + (params.name || Date.now());
  const logFile = "/tmp/" + name + ".log";
  for (let attempt = 0; attempt < 3; attempt++) {
    await runDetached("pkill -f 'cloudflared tunnel --url " + shq(target) + "' 2>/dev/null; sleep 2; nohup cloudflared tunnel --url " + shq(target) + " --loglevel error > " + logFile + " 2>&1 &");
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await runCommand("cat " + logFile + " 2>/dev/null");
      const m = (r.stdout || "").match(/https:\/\/[a-z0-9-]{4,}\.trycloudflare\.com/);
      if (m) return { url: m[0], target };
    }
  }
  const r = await runCommand("cat " + logFile + " 2>/dev/null");
  return { url: (r.stdout || "").match(/https:\/\/[a-z0-9-]{4,}\.trycloudflare\.com/) || "", target };
}

// ── start ──────────────────────────────────────────────────────
connect();
setInterval(() => { if (!socket) connect(); }, 15000);
setInterval(() => { if (socket) buildFrame({ type: "ping" }); }, 45000);
