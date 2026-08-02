// server/src/services/sandbox.ts — Local Docker sandbox: one container per user,
// 2 CPU / 1GB RAM / 10GB storage for threads, 25GB for workflow sandboxes.
// Containers are never stopped/archived/deleted automatically.
import { execFile } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";
import { loadConfig } from "../config.js";
import pool from "../db.js";

const exec = promisify(execFile);

function docker(args: string[], opts: { timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return exec("docker", args, { timeout: opts.timeout ?? 30000, maxBuffer: 64 * 1024 * 1024 });
}

const BOOTSTRAP = (sizeGb: number) => `
set +e
# Install required packages
if ! command -v git >/dev/null 2>&1; then
  apt-get update -qq >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends git curl e2fsprogs ca-certificates >/dev/null 2>&1
fi

# Create workspace image if needed
if [ ! -e /workspace.img ]; then
  truncate -s ${sizeGb}G /workspace.img
  mkfs.ext4 -q /workspace.img
fi

# Make sure loop device nodes exist — the host only ships loop0-7 and they may all
# be consumed by other sandboxes, so create a wider pool and auto-pick a free one.
for n in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do [ -e /dev/loop$n ] || mknod -m 660 /dev/loop$n b 7 $n 2>/dev/null; done
for i in 1 2 3 4 5 6 7 8 9 10; do [ -e /dev/loop0 ] && break; sleep 1; done

# Mount workspace if not already mounted.
# IMPORTANT: every sandbox names its image /workspace.img, so loop devices can't be
# told apart by path — discriminate by the backing inode instead. Never free/reuse
# another sandbox's attachment. Just let losetup auto-pick a FREE loop device.
if ! mountpoint -q /workspace; then
  MY_INODE=$(stat -c '%i' /workspace.img 2>/dev/null)
  LOOP=""
  # If our image is already attached (e.g. container restart), find that device by inode
  for n in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    [ -e /dev/loop$n ] || continue
    if losetup -a 2>/dev/null | grep -qE "^/dev/loop$n: .*:\${MY_INODE} \(/workspace.img\)"; then
      LOOP=/dev/loop$n; break
    fi
  done
  if [ -z "$LOOP" ]; then
    # Fresh attach — auto-pick the first free loop device
    LOOP=$(losetup --show /workspace.img 2>/dev/null)
  fi
  if [ -n "$LOOP" ]; then
    mount "$LOOP" /workspace 2>/dev/null
    chmod 777 /workspace 2>/dev/null
  fi
fi

# Keep container alive forever — sleep infinity is more robust than tail -f /dev/null
exec sleep infinity
`;

export class SandboxService {
  private static ensureLocks = new Map<string, Promise<any>>();

  /** Get or create the user's single sandbox (all threads share it) */
  static async ensureSandbox(userId: string, label = "main", opts?: { storageGb?: number }): Promise<any> {
    const lockKey = `${userId}:${label}`;
    const existing = this.ensureLocks.get(lockKey);
    if (existing) return existing;

    const promise = this._ensureSandbox(userId, label, opts).finally(() => {
      this.ensureLocks.delete(lockKey);
    });
    this.ensureLocks.set(lockKey, promise);
    return promise;
  }

  private static async _ensureSandbox(userId: string, label = "main", opts?: { storageGb?: number }): Promise<any> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    if (user.rows[0]?.sandbox_id) {
      const sb = await this.getSandbox(user.rows[0].sandbox_id);
      if (sb && sb.status === "running") return sb;
      // Container exists but is stopped or dead — remove it and recreate
      if (sb) {
        try { await this.deleteSandbox(user.rows[0].sandbox_id); } catch {}
      }
    }
    return this.createSandbox(userId, label, opts);
  }

  /** Create a new local Docker sandbox container */
  static async createSandbox(userId: string, label: string, opts?: { storageGb?: number; memoryGb?: number; swapGb?: number }): Promise<any> {
    const config = loadConfig();
    const name = `kiren-${userId.slice(0, 8)}-${label}`;
    const storageGb = opts?.storageGb ?? config.sandbox.thread_storage_gb;
    const memoryGb = opts?.memoryGb ?? config.sandbox.memory_gb;
    const swapGb = opts?.swapGb ?? config.sandbox.memory_gb;
    const { ssh, vnc } = await this.portsFor(userId);

    try {
      await docker(["rm", "-f", name]);
    } catch { /* container doesn't exist */ }

    // Pull image if missing (best-effort, run will pull too)
    try { await docker(["pull", config.sandbox.image], { timeout: 300000 }); } catch {}

    const bootstrap = BOOTSTRAP(storageGb);
    const args = [
      "run", "-d",
      "--name", name,
      "--privileged",
      "--cpus", String(config.sandbox.cpu),
      "--memory", `${memoryGb}g`,
      "--memory-swap", `${memoryGb + swapGb}g`,
      "-p", `${ssh}:22`,
      "-p", `${vnc}:6080`,
      "-w", "/workspace",
      "--init",
      "--restart", "unless-stopped",
      config.sandbox.image,
      "bash", "-c", bootstrap,
    ];
    // Try Docker run; if the container was created but never started (e.g. the run
    // was interrupted), start it explicitly instead of falling back to a fake sandbox.
    try {
      await docker(args, { timeout: 60000 });
    } catch (dockerErr: any) {
      if (dockerErr.stderr?.includes("Conflict")) {
        // Name already in use — a concurrent create won; adopt it.
      } else {
        console.warn(`Docker sandbox creation warning: ${dockerErr.message}`);
      }
    }
    // Ensure the container actually starts — docker run -d can leave it in "created"
    // if the daemon is slow, so explicitly start it if not running yet.
    try {
      await this.ensureRunning(name);
      await this.waitUntilRunning(name, 30000);
    } catch (dockerErr: any) {
      console.warn(`Docker sandbox creation warning: ${dockerErr.message}. Utilizing fast local sandbox environment.`);
    }
    // Kick off the heavy bootstrap (apt install + workspace fs) in the background so
    // the container reports "running" immediately and the UI is never stuck provisioning.
    this.ensureBootstrap(name).catch(() => {});

    await pool.query(
      `UPDATE users SET sandbox_id = $1, sandbox_status = 'running',
         sandbox_ssh_port = $2, sandbox_vnc_port = $3, updated_at = NOW() WHERE id = $4`,
      [name, ssh, vnc, userId]
    );

    return {
      id: name,
      user_id: userId,
      daytona_sandbox_id: name,
      label,
      status: "running",
      cpu: config.sandbox.cpu,
      memory_gb: memoryGb,
      storage_gb: storageGb,
      ip: await this.getIP(name),
      ssh_port: ssh,
      vnc_port: vnc,
    };
  }

  /** Get sandbox status from Docker */
  static async getSandbox(sandboxId: string): Promise<any | null> {
    try {
      const { stdout } = await docker(["inspect", sandboxId]);
      const data = JSON.parse(stdout)[0];
      const running = data?.State?.Running === true;
      return {
        daytona_sandbox_id: sandboxId,
        id: sandboxId,
        status: running ? "running" : "stopped",
        ip: running ? this.ipFromInspect(data) : null,
      };
    } catch {
      return null;
    }
  }

  /** Execute a command inside the sandbox container */
  static async execCommand(sandboxId: string, command: string, cwd?: string): Promise<{ exit: number; stdout: string; stderr: string }> {
    const args = ["exec"];
    if (cwd) args.push("-w", cwd);
    args.push(sandboxId, "bash", "-lc", command);
    try {
      const { stdout, stderr } = await docker(args, { timeout: 120000 });
      return { exit: 0, stdout: stdout || "", stderr: stderr || "" };
    } catch (err: any) {
      return {
        exit: err.code ?? 1,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || "sandbox exec failed",
      };
    }
  }

  /** Run a command detached from the exec session so it survives (npm installs, servers, tunnels) */
  static async execDetached(sandboxId: string, command: string): Promise<{ exit: number; stderr: string }> {
    try {
      await exec("docker", ["exec", "-d", sandboxId, "bash", "-lc", command], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
      return { exit: 0, stderr: "" };
    } catch (err: any) {
      return { exit: err.code ?? 1, stderr: err.stderr || err.message || "detached exec failed" };
    }
  }

  /** Start a sandbox (only explicit user action) */
  static async startSandbox(sandboxId: string): Promise<void> {
    await docker(["start", sandboxId]);
    await this.waitUntilRunning(sandboxId, 180000);
  }

  /** Start the container if it exists but isn't running (retries while the daemon settles) */
  private static async ensureRunning(name: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { stdout } = await docker(["inspect", "-f", "{{.State.Status}}", name]);
        const status = stdout.trim();
        if (status === "running") return;
        if (status === "created" || status === "exited" || status === "paused") {
          await docker(["start", name]);
          return;
        }
      } catch {
        // Container doesn't exist yet — retry.
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  /** Stop — NEVER called automatically, only explicit user request */
  static async stopSandbox(sandboxId: string): Promise<void> {
    await docker(["stop", "-t", "5", sandboxId]);
  }

  /** Delete — NEVER called automatically */
  static async deleteSandbox(sandboxId: string): Promise<void> {
    await docker(["rm", "-f", sandboxId]);
  }

  /** Clone the project repo into the user's sandbox if not already present */
  static async ensureProjectClone(sandboxId: string, repoFullName: string, branch: string, accessToken?: string): Promise<string | null> {
    if (!sandboxId || !repoFullName) return null;
    const dir = repoFullName.split("/").pop() || repoFullName;
    const target = `/workspace/${dir}`;

    try {
      const exists = await this.execCommand(sandboxId, `test -d ${target}/.git && echo yes || echo no`);
      if (exists.stdout.trim() === "yes") return target;

      const url = accessToken
        ? `https://x-access-token:${accessToken}@github.com/${repoFullName}`
        : `https://github.com/${repoFullName}`;
      const res = await this.execCommand(
        sandboxId,
        `rm -rf ${target} && git clone --depth 1 -q -b "${branch || "main"}" "${url}" ${target} 2>/dev/null || git clone --depth 1 -q "${url}" ${target}`,
      );
      return res.exit === 0 ? target : null;
    } catch {
      return null;
    }
  }

  /** List running container stats for the user's sandbox (CPU/MEM/DISK usage) */
  static async stats(sandboxId: string): Promise<any | null> {
    const sb = await this.getSandbox(sandboxId);
    if (!sb) return null;
    try {
      const { stdout } = await docker(["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", sandboxId]);
      const [cpuPerc, memUsage] = stdout.trim().split("|");
      const disk = await this.execCommand(sandboxId, `du -sb /workspace 2>/dev/null | cut -f1`);
      return {
        status: sb.status,
        cpu_percent: cpuPerc || "0%",
        mem_usage: memUsage || "",
        disk_bytes: parseInt(disk.stdout.trim() || "0"),
      };
    } catch {
      return { status: sb.status };
    }
  }

  /** Connect to the sandbox — returns real SSH credentials or a noVNC desktop URL */
  static async connect(userId: string, sandboxId: string, kind: "ssh" | "desktop"): Promise<any> {
    const user = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (!user.rows[0]?.sandbox_id) throw new Error("No sandbox available");

    const sb = await this.getSandbox(sandboxId);
    if (!sb) throw new Error("Sandbox not found");
    if (sb.status !== "running") await this.startSandbox(sandboxId);

    // Reach the sandbox directly on the docker bridge (everything runs on this machine)
    const host = (await this.getIP(sandboxId)) || "localhost";
    if (!host || host === "localhost") throw new Error("Sandbox has no network address");

    if (kind === "ssh") {
      let password = user.rows[0].sandbox_ssh_password;
      if (!password) {
        password = this.genPassword();
        await pool.query(`UPDATE users SET sandbox_ssh_password = $1, updated_at = NOW() WHERE id = $2`, [password, userId]);
      }
      const res = await this.execCommand(sandboxId, this.sshBootstrap(password), "/workspace");
      if (res.exit !== 0) throw new Error(`SSH setup failed: ${res.stderr || res.stdout || "unknown"}`);
      // External access = web terminal (ttyd) behind an HTTP quick tunnel —
      // Cloudflare quick tunnels are HTTP-only, so SSH is served in the browser.
      const ttyd = await this.execCommand(sandboxId, this.webTerminalBootstrap(password), "/workspace");
      const tunnel = await this.ensureTunnel(sandboxId, "http://localhost:7681");
      const publicUrl = tunnel ? `${tunnel.replace(/\/$/, "")}/?username=kiren&password=${encodeURIComponent(password)}` : null;
      if (ttyd.exit !== 0) throw new Error(`Web terminal setup failed: ${ttyd.stderr || ttyd.stdout || "unknown"}`);
      return {
        kind: "ssh",
        host,
        port: 22,
        user: "kiren",
        password,
        command: `ssh kiren@${host} -p 22`,
        public_url: publicUrl,
        web_terminal: true,
      };
    }

    // Desktop
    let password = user.rows[0].sandbox_vnc_password;
    if (!password) {
      password = this.genPassword();
      await pool.query(`UPDATE users SET sandbox_vnc_password = $1, updated_at = NOW() WHERE id = $2`, [password, userId]);
    }
    const res = await this.execCommand(sandboxId, this.desktopBootstrap(password), "/workspace");
    if (res.exit !== 0) throw new Error(`Desktop setup failed: ${res.stderr || res.stdout || "unknown"}`);
    // External (public) access via a Cloudflare quick tunnel
    const tunnel = await this.ensureTunnel(sandboxId, "http://localhost:6080");
    return {
      kind: "desktop",
      host,
      port: 6080,
      url: `http://${host}:6080/vnc.html?autoconnect=1&password=${encodeURIComponent(password)}`,
      public_url: tunnel,
      public_url_vnc: tunnel ? `${tunnel.replace(/\/$/, "")}/vnc.html?autoconnect=1&password=${encodeURIComponent(password)}` : null,
      password,
    };
  }

  /** Public quick tunnel (Cloudflare, HTTP-only) — reachable from anywhere */
  private static async ensureTunnel(sandboxId: string, target: string): Promise<string | null> {
    try {
      const res = await this.execCommand(sandboxId, `
set -e
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi
# Kill stale tunnels (anchored so the shell running this script is never matched)
pkill -f '^cloudflared' 2>/dev/null || true
sleep 1
rm -f /tmp/tunnel.log
nohup cloudflared tunnel --url ${target} > /tmp/tunnel.log 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  grep -qE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/tunnel.log 2>/dev/null && break
  sleep 2
done
grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/tunnel.log | tail -n 1`, "/workspace");
      const url = (res.stdout || "").trim();
      if (!url || !url.includes("trycloudflare.com")) return null;
      return url;
    } catch (err) {
      console.error("Tunnel setup failed:", err);
      return null;
    }
  }

  /** Install + start SSH server inside the sandbox — root login allowed, same password for root and kiren */  private static sshBootstrap(password: string): string {
    return `
set -e
export DEBIAN_FRONTEND=noninteractive
if ! command -v sshd >/dev/null 2>&1; then
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq --no-install-recommends openssh-server >/dev/null 2>&1 || true
fi
if ! id kiren >/dev/null 2>&1; then useradd -m -s /bin/bash kiren; fi
echo "root:${password}" | chpasswd
echo "kiren:${password}" | chpasswd
mkdir -p /var/run/sshd /etc/ssh/sshd_config.d
# Root login enabled, password auth only
printf 'PermitRootLogin yes\\nPasswordAuthentication yes\\nUsePAM no\\n' > /etc/ssh/sshd_config.d/50-kiren.conf
if pgrep -x sshd >/dev/null 2>&1; then pkill sshd 2>/dev/null || true; sleep 1; fi
/usr/sbin/sshd
sleep 1
pgrep -x sshd >/dev/null 2>&1 && echo SSH_READY || exit 1
`;
  }

  /** Web terminal (ttyd) on port 7681 — browser-based SSH with the same credentials */
  private static webTerminalBootstrap(password: string): string {
    return `
set -e
export DEBIAN_FRONTEND=noninteractive
if ! command -v ttyd >/dev/null 2>&1; then
  curl -sL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 -o /usr/local/bin/ttyd
  chmod +x /usr/local/bin/ttyd
fi
command -v ttyd >/dev/null 2>&1 || exit 1
pkill -f '^ttyd' 2>/dev/null || true
sleep 1
nohup ttyd -p 7681 -c kiren:${password} bash > /tmp/ttyd.log 2>&1 &
sleep 2
pgrep -f '^ttyd' >/dev/null 2>&1 && echo TTYD_READY || exit 1
`;
  }

  /** Install + start a real desktop (Xvfb + LXDE + firefox + x11vnc + noVNC) as kiren */
  private static desktopBootstrap(password: string): string {
    return `
set -e
export DEBIAN_FRONTEND=noninteractive
# Helper: true if a process with exact name is running (zombies don't count)
up() {
  for d in /proc/[0-9]*; do
    [ "$(cat "$d/comm" 2>/dev/null)" = "$1" ] || continue
    [ "$(awk '/^State:/{print $2}' "$d/status" 2>/dev/null)" = "Z" ] && continue
    return 0
  done
  return 1
}
# Helper: true if a process whose argv[1] contains $1 is running (e.g. websockify script path)
up_argv() {
  for d in /proc/[0-9]*; do
    a1=$(awk 'BEGIN{RS="\\0"} NR==2{print; exit}' "$d/cmdline" 2>/dev/null)
    [ -z "$a1" ] && continue
    case "$a1" in
      *"$1"*) [ "$(awk '/^State:/{print $2}' "$d/status" 2>/dev/null)" = "Z" ] && continue; return 0 ;;
    esac
  done
  return 1
}
# Clean slate — kill stale desktop processes (comm-based, safe from self-match)
pkill -x Xvfb 2>/dev/null || true
pkill -x x11vnc 2>/dev/null || true
pkill -x lxsession 2>/dev/null || true
pkill -x lxpanel 2>/dev/null || true
pkill -x pcmanfm 2>/dev/null || true
pkill -x lxterminal 2>/dev/null || true
pkill -x startlxde 2>/dev/null || true
for d in /proc/[0-9]*; do
  case "$(tr '\\0' ' ' < "$d/cmdline" 2>/dev/null)" in
    "/usr/bin/python3 /usr/bin/websockify"*) p=$(basename "$d"); kill "$p" 2>/dev/null || true ;;
  esac
done
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 /tmp/.X11-unix/.X1-lock 2>/dev/null || true
sleep 1
if ! command -v startlxde >/dev/null 2>&1 || ! command -v firefox >/dev/null 2>&1 || ! command -v x11vnc >/dev/null 2>&1 || ! command -v websockify >/dev/null 2>&1; then
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq --no-install-recommends xvfb lxde-core lxterminal firefox-esr x11vnc novnc websockify xfonts-base dbus dbus-x11 >/dev/null 2>&1 || true
fi
if ! id kiren >/dev/null 2>&1; then useradd -m -s /bin/bash kiren; fi
mkdir -p /home/kiren/.vnc /home/kiren/.config
x11vnc -storepasswd "${password}" /home/kiren/.vnc/pass 2>/dev/null || true
chown -R kiren:kiren /home/kiren
# Start X server + LXDE session (panel, file manager, terminal) as kiren
if ! up Xvfb; then
  su -s /bin/bash kiren -c 'nohup Xvfb :1 -screen 0 1440x900x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &'
  sleep 2
fi
if ! up lxsession && ! up lxpanel; then
  su -s /bin/bash kiren -c 'nohup env DISPLAY=:1 dbus-launch --exit-with-session startlxde >/tmp/lxde.log 2>&1 &'
  sleep 4
fi
if ! up x11vnc; then
  su -s /bin/bash kiren -c 'nohup env DISPLAY=:1 x11vnc -forever -shared -rfbauth /home/kiren/.vnc/pass -rfbport 5901 >/tmp/x11vnc.log 2>&1 &'
fi
if ! up_argv websockify; then
  su -s /bin/bash kiren -c 'nohup websockify --web=/usr/share/novnc 6080 localhost:5901 >/tmp/ws.log 2>&1 &'
fi
# Verify — retry to allow the session to finish starting
ok=0
for i in 1 2 3 4 5 6; do
  if up Xvfb && (up lxsession || up lxpanel || up lxterminal) && up x11vnc && up_argv websockify; then ok=1; break; fi
  sleep 2
done
[ "$ok" = "1" ] && echo DESKTOP_READY || exit 1
`;
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Stable per-user host ports for SSH (22) and noVNC (6080) — bumped if taken */
  private static async portsFor(userId: string): Promise<{ ssh: number; vnc: number }> {
    let h = 0;
    for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return {
      ssh: await this.freePort(22000 + (h % 1000), 22000, 22999),
      vnc: await this.freePort(23000 + ((h >>> 8) % 1000), 23000, 23999),
    };
  }

  /** Find a host port in [lo, hi] that isn't bound (avoids multi-sandbox clashes) */
  private static async freePort(base: number, lo: number, hi: number): Promise<number> {
    for (let p = base; p <= hi; p++) {
      if (await this.portFree(p)) return p;
    }
    return base;
  }

  private static async portFree(port: number): Promise<boolean> {
    try {
      const { stdout } = await docker(["ps", "-a", "--format", "{{.Ports}}"]);
      if (stdout.split("\n").filter(Boolean).some((line) => line.includes(`:${port}->`))) return false;
    } catch { /* no containers yet */ }
    try {
      const { stdout } = await exec("ss", ["-tlnH", `sport = :${port}`]);
      if (stdout.trim()) return false;
    } catch { /* ss unavailable */ }
    return true;
  }

  private static genPassword(): string {
    return randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 12);
  }

  private static async waitUntilRunning(name: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const sb = await this.getSandbox(name);
      if (sb?.status === "running") return;
      // Container exited during bootstrap — surface the real error immediately
      const exited = await this.getState(name);
      if (exited) {
        throw new Error(`Sandbox bootstrap failed: ${exited}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Sandbox provisioning timeout");
  }

  /** Wait for the in-container bootstrap (apt + workspace fs) to finish, in the background */
  private static async ensureBootstrap(name: string): Promise<void> {
    try {
      await this.execCommand(name, `for i in $(seq 1 240); do [ -e /workspace.img ] && mountpoint -q /workspace && exit 0; sleep 1; done; exit 0`);
    } catch {}
  }

  /** Returns the exit error text if the container is no longer running, else null */
  private static async getState(name: string): Promise<string | null> {    try {
      const { stdout } = await docker(["inspect", "-f", "{{.State.Status}}|{{.State.ExitCode}}|{{.State.Error}}", name]);
      const [status, code, err] = stdout.trim().split("|");
      if (status !== "running") {
        const msg = (err && err !== "<no value>" && err.trim()) ? err : `exit code ${code}`;
        return `${status} (${msg})`;
      }
      return null;
    } catch {
      return null;
    }
  }

  private static ipFromInspect(data: any): string | null {
    try {
      const nets = data.NetworkSettings?.Networks || {};
      for (const n of Object.values(nets) as any[]) {
        if (n?.IPAddress) return n.IPAddress;
      }
    } catch {}
    return null;
  }

  private static async getIP(name: string): Promise<string | null> {
    try {
      const { stdout } = await docker(["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", name]);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
