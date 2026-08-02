// server/src/index.ts — Kiren main server
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config.js";
import { NotificationService } from "./services/notification.js";
import { planBlockMiddleware } from "./middleware/plan-block.js";

// Route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import modelRoutes from "./routes/models.js";
import githubRoutes from "./routes/github.js";
import threadRoutes from "./routes/threads.js";
import sandboxRoutes from "./routes/sandboxes.js";
import workflowRoutes from "./routes/workflows.js";
import automationRoutes from "./routes/automations.js";
import mcpRoutes from "./routes/mcp.js";
import deploymentRoutes from "./routes/deployments.js";
import notificationRoutes from "./routes/notifications.js";
import billingRoutes from "./routes/billing.js";
import subagentRoutes from "./routes/subagents.js";
import deviceRoutes from "./routes/devices.js";
import skillRoutes from "./routes/skills.js";
import hookRoutes from "./routes/hooks.js";
import templateRoutes from "./routes/templates.js";
import analysisRoutes from "./routes/analysis.js";
import updateRoutes from "./routes/updates.js";
import projectRoutes from "./routes/projects.js";
import smtpRoutes from "./routes/smtp.js";
import resetRoutes from "./routes/reset.js";
import n8nRoutes from "./routes/n8n.js";
import workflowTemplateRoutes from "./routes/workflow-templates.js";
import nodeRoutes from "./routes/nodes.js";
import { NodeService } from "./services/node.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const config = loadConfig();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || config.app.port || 3001;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: [config.app.frontend_url, "http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(planBlockMiddleware);

// ── Health check ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: config.app.version,
    timestamp: new Date().toISOString(),
    mobile_url: `http://${config.app.mobile_domain}`,
  });
});

// ── API Routes ───────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/threads", threadRoutes);
app.use("/api/sandboxes", sandboxRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/automations", automationRoutes);
app.use("/api/mcp", mcpRoutes);
app.use("/api/deployments", deploymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/subagents", subagentRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/hooks", hookRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/updates", updateRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/smtp", smtpRoutes);
app.use("/api/reset", resetRoutes);
app.use("/api/n8n", n8nRoutes);
app.use("/api/workflow-templates", workflowTemplateRoutes);
app.use("/api/nodes", nodeRoutes);

// OpenAI-compatible API
app.use("/v1", modelRoutes);

// ── Mobile Web App ─────────────────────────────────────────────
app.get("/mobile", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "mobile", "index.html"));
});
app.get("/mobile/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "mobile", "manifest.json"));
});

// Device pairing page
app.get("/device", (req, res) => {
  res.json({
    pairing_url: `http://${config.app.mobile_domain}`,
    instructions: "Open this URL on your phone or scan the QR code from Settings > Devices in the desktop app.",
    desktop_url: `http://localhost:${PORT}/api/devices/pair`
  });
});

// ── WebSocket for real-time updates ──────────────────────────────
const wss = new WebSocketServer({ noServer: true });

// ── Node agent hub (connect-back) ───────────────────────────────
// Nodes with no public IP dial OUT here. Auth by node token header.
const nodeWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url || "", `http://localhost:${PORT}`).pathname;
  if (pathname === "/ws/node") {
    nodeWss.handleUpgrade(req, socket, head, (ws) => nodeWss.emit("connection", ws, req));
  } else if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  ws.on("error", (e) => console.error("[ws] client socket error:", e.message));
  // Extract token from query
  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.close(1008, "No token");
    return;
  }

  // Verify token and get user
  import("./db.js").then(({ default: pool }) => {
    pool.query(
      `SELECT u.id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1`,
      [token]
    ).then((result) => {
      if (result.rows.length === 0) {
        ws.close(1008, "Invalid token");
        return;
      }
      const userId = result.rows[0].id;
      NotificationService.addConnection(userId, ws);

      ws.send(JSON.stringify({ type: "connected", userId }));

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          // Handle client messages if needed
        } catch {}
      });
    });
  });
});

nodeWss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  const token = (url.searchParams.get("token") || req.headers["x-node-token"] || "").toString();
  if (!token) {
    ws.close(1008, "No node token");
    return;
  }
  NodeService.handleSocket(ws, token).catch(() => {});
});

// ── Start server ─────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     Kiren Server v${config.app.version}                    ║
╠═══════════════════════════════════════════════════════════════╣
║  API:        http://localhost:${PORT}                          ║
║  WebSocket:  ws://localhost:${PORT}/ws                         ║
║  Models API: http://localhost:${PORT}/v1/models                ║
║  Health:     http://localhost:${PORT}/api/health                ║
╠═══════════════════════════════════════════════════════════════╣
║  Models:     32 models configured                             ║
║  Providers:  kiren.knr.cl/v1 (all models)                   ║
║  Sandbox:    local Docker (2 CPU · 1GB RAM)                 ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  console.log(`Models base: ${config.models.base_url}`);
  console.log(`Sandbox:     local Docker · ${config.sandbox.image} · threads ${config.sandbox.thread_storage_gb}GB · workflows ${config.sandbox.workflow_storage_gb}GB`);
  console.log(`Mobile:      http://${config.app.mobile_domain}`);
  console.log(`n8n auth:    ${config.n8n.basic_auth_user ? 'enabled' : 'disabled (public)'}`);
  console.log(`Sandbox:     auto_stop=${config.sandbox.auto_stop}, auto_archive=${config.sandbox.auto_archive}`);

  // Keep the dynamic DNS record pointed at this machine (HTTP so it works without TLS)
  if (config.afraid_dns?.sync_url) {
    fetch(config.afraid_dns.sync_url).catch((e) =>
      console.error("afraid_dns sync failed:", e.message)
    );
    console.log("afraid_dns:  sync fired for", config.afraid_dns.domain || config.app.base_domain);
  }

});

export default app;
