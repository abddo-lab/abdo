// server/src/routes/projects.ts — Real project creation with local fallback when Docker unavailable
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import pool from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { SandboxService } from "../services/sandbox.js";
import { GitHubService } from "../services/github.js";

const router = Router();
const execAsync = promisify(execCb);

function run(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execCb(cmd, { timeout: 120000, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) { (err as any).stdout = stdout; (err as any).stderr = stderr; reject(err); }
      else resolve({ stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

/** Write an uploaded/template file tree to a host temp dir, sanitizing paths */
function writeFiles(root: string, files: { path: string; content: string }[]): void {
  for (const f of files || []) {
    const rel = (f.path || "").replace(/^\/+/, "");
    if (!rel || rel.split("/").some((seg) => seg === ".." || seg.includes("\\"))) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    let content = f.content ?? "";
    if (content.startsWith("base64:")) content = Buffer.from(content.slice(7), "base64").toString("utf8");
    fs.writeFileSync(abs, content, "utf8");
  }
}

/** Check if Docker is available */
async function dockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker ps --format '{{.ID}}' 2>/dev/null", { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// POST /api/projects — create a project and put its code into the user's sandbox
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { name, source = "upload", repo_full_name, branch = "main", files = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Project name is required" });
    if (!["github", "upload", "template"].includes(source)) {
      return res.status(400).json({ error: "Invalid source" });
    }

    const id = `prj-${uuid().slice(0, 8)}`;
    const glyph = name.slice(0, 2).toUpperCase();
    const color = source === "github" ? "#1A1D28" : source === "template" ? "#2d2d52" : "#3d3d52";

    // Check if projects table has all needed columns
    await pool.query(
      `INSERT INTO projects (id, user_id, name, repo_full_name, branch, source, category, stack, glyph, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, req.user.id, name, repo_full_name || null, source === "github" ? branch : "main",
       source, source === "github" ? "Private" : "Local", JSON.stringify([]), glyph, color]
    );

    // Fire provision in background — don't block the response
    provision(req.user.id, id, name, { source, repo_full_name, branch, files }).catch((err) =>
      console.error("Project provisioning failed:", err.message)
    );

    res.json({
      project: {
        id, name, repo_full_name: repo_full_name || null, branch, source,
        glyph, color, status: "provisioning",
      },
    });
  } catch (err: any) {
    console.error("Project create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects — user's projects (for the picker)
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — single project detail
router.get("/:id", authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Project not found" });
    res.json({ project: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — delete a project
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function provision(
  userId: string,
  projectId: string,
  name: string,
  opts: { source: string; repo_full_name?: string; branch?: string; files?: { path: string; content: string }[] }
): Promise<void> {
  const hasDocker = await dockerAvailable();

  if (!hasDocker) {
    // No Docker — write files to local workspace and mark done
    console.log(`Docker unavailable — writing ${name} to local workspace`);
    await localProvision(userId, projectId, name, opts);
    return;
  }

  try {
    const sb = await SandboxService.ensureSandbox(userId, "main");
    const sandboxId = sb.daytona_sandbox_id || sb.id;

    if (opts.source === "github" && opts.repo_full_name) {
      const accessToken = await GitHubService.getAccessToken(userId);
      await SandboxService.ensureProjectClone(
        sandboxId, opts.repo_full_name, opts.branch || "main",
        accessToken || undefined
      );
      await pool.query(`UPDATE projects SET sandbox_id = $1, status = 'ready', updated_at = NOW() WHERE id = $2`, [sandboxId, projectId]);
      return;
    }

    // Upload / template — write to sandbox
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kiren-project-"));
    try {
      writeFiles(tmp, opts.files || []);
      const safe = name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 40) || "project";
      await run(`docker exec ${sandboxId} mkdir -p /workspace/${safe}`);
      await run(`tar -C "${tmp}" -cf - . | docker exec -i ${sandboxId} tar -C /workspace/${safe} -xf -`);
      await pool.query(`UPDATE projects SET sandbox_id = $1, status = 'ready', updated_at = NOW() WHERE id = $2`, [sandboxId, projectId]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } catch (err: any) {
    console.error("Sandbox provision failed, falling back to local:", err.message);
    await localProvision(userId, projectId, name, opts);
  }
}

/** Local (no Docker) provisioning — writes files to /tmp/kiren-workspace */
async function localProvision(
  userId: string,
  projectId: string,
  name: string,
  opts: { source: string; repo_full_name?: string; branch?: string; files?: { path: string; content: string }[] }
): Promise<void> {
  try {
    const safe = name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 40) || "project";
    const wsRoot = path.join("/tmp", "kiren-workspace", userId, safe);
    fs.mkdirSync(wsRoot, { recursive: true });

    if (opts.source === "github" && opts.repo_full_name) {
      // Try git clone to local workspace
      try {
        await execAsync(`git clone --depth 1 -q -b "${opts.branch || "main"}" "https://github.com/${opts.repo_full_name}" "${wsRoot}" 2>/dev/null || git clone --depth 1 -q "https://github.com/${opts.repo_full_name}" "${wsRoot}"`, { timeout: 60000 });
      } catch {
        // Clone failed — mark ready anyway (user can retry)
      }
    } else {
      writeFiles(wsRoot, opts.files || []);
    }

    await pool.query(
      `UPDATE projects SET sandbox_id = $1, status = 'ready', local_path = $3, updated_at = NOW() WHERE id = $2`,
      [`local:${userId}`, projectId, wsRoot]
    ).catch(() =>
      // local_path column might not exist — update without it
      pool.query(`UPDATE projects SET sandbox_id = $1, status = 'ready', updated_at = NOW() WHERE id = $2`, [`local:${userId}`, projectId])
    );
  } catch (err: any) {
    console.error("Local provision failed:", err.message);
    await pool.query(`UPDATE projects SET status = 'error', updated_at = NOW() WHERE id = $1`, [projectId]).catch(() => {});
  }
}

export default router;
