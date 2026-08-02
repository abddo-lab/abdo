// server/src/services/computer.ts — Manus-style computer use on the sandbox desktop.
// Drives the real desktop (Xvfb + LXDE + firefox + x11vnc) with xdotool:
// screenshots, clicks, typing, keys, and opening URLs — agent-in-the-loop like Manus.
import { SandboxService } from "./sandbox.js";

export class ComputerService {
  /** Perform a desktop action and return the result */
  static async perform(sandboxId: string, args: any): Promise<string> {
    if (!sandboxId) return "ERROR: no sandbox available";
    const mode = (args.mode || args.action || "screenshot").toLowerCase();
    const DISPLAY = "DISPLAY=:1";

    switch (mode) {
      case "screenshot": {
        const r = await SandboxService.execCommand(sandboxId,
          `${DISPLAY} import -window root /tmp/computer.png 2>/dev/null || xwd -root -display :1 -out /tmp/computer.xwd 2>/dev/null && (command -v convert >/dev/null 2>&1 && convert /tmp/computer.xwd /tmp/computer.png 2>/dev/null); test -s /tmp/computer.png && echo SCREENSHOT_OK || echo SCREENSHOT_FAIL`);
        if (r.stdout.includes("SCREENSHOT_OK")) {
          const b64 = await SandboxService.execCommand(sandboxId, `base64 -w0 /tmp/computer.png 2>/dev/null`);
          return `Screenshot captured (${(b64.stdout.length * 0.75).toFixed(0)} bytes PNG). Send it to the vision model to inspect.`;
        }
        return `Screenshot failed. Is the desktop running? (${r.stderr || r.stdout})`;
      }

      case "click": {
        const x = args.x ?? args.left ?? 0;
        const y = args.y ?? args.top ?? 0;
        const r = await SandboxService.execCommand(sandboxId,
          `${DISPLAY} xdotool mousemove ${x} ${y} click 1 2>&1`);
        return r.exit === 0 ? `Clicked at (${x}, ${y})` : `Click failed: ${r.stderr}`;
      }

      case "type": {
        const text = (args.text ?? "").replace(/"/g, '\\"');
        const r = await SandboxService.execCommand(sandboxId,
          `${DISPLAY} xdotool type --delay 30 "${text}" 2>&1`);
        return r.exit === 0 ? `Typed "${args.text}"` : `Typing failed: ${r.stderr}`;
      }

      case "key": {
        const key = args.key || args.keys || "Return";
        const r = await SandboxService.execCommand(sandboxId,
          `${DISPLAY} xdotool key ${key} 2>&1`);
        return r.exit === 0 ? `Pressed key ${key}` : `Key failed: ${r.stderr}`;
      }

      case "open": {
        const url = args.url || args.open || "";
        const r = await SandboxService.execCommand(sandboxId,
          `su -s /bin/bash kiren -c '${DISPLAY} firefox "${url}" >/tmp/ff.log 2>&1 &' ; sleep 2; ${DISPLAY} xdotool key F11 2>/dev/null; echo OPENED`);
        return url ? `Opened ${url} in Firefox on the desktop` : `No URL given`;
      }

      case "scroll": {
        const clicks = args.clicks ?? args.amount ?? 5;
        const r = await SandboxService.execCommand(sandboxId,
          `${DISPLAY} xdotool click --repeat ${clicks} --delay 60 4 2>&1`);
        return r.exit === 0 ? `Scrolled down ${clicks} clicks` : `Scroll failed: ${r.stderr}`;
      }

      default:
        return `Unknown computer mode '${mode}'. Modes: screenshot, click {x,y}, type {text}, key {key}, open {url}, scroll {clicks}.`;
    }
  }

  /** Ensure the desktop (Xvfb + LXDE + xdotool) is booted inside the sandbox */
  static async ensureDesktop(sandboxId: string): Promise<boolean> {
    if (!sandboxId) return false;
    const r = await SandboxService.execCommand(sandboxId,
      `command -v xdotool >/dev/null 2>&1 && DISPLAY=:1 xdotool getactivewindow >/dev/null 2>&1 && echo DESKTOP_READY || echo NEED_SETUP`);
    if (r.stdout.includes("DESKTOP_READY")) return true;
    // Boot the desktop (Xvfb + LXDE + xdotool) — needs a kiren user
    try {
      const boot = await SandboxService.execCommand(sandboxId, `
        export DEBIAN_FRONTEND=noninteractive
        if ! id kiren >/dev/null 2>&1; then useradd -m -s /bin/bash kiren; fi
        apt-get update -qq >/dev/null 2>&1 || true
        apt-get install -y -qq --no-install-recommends xdotool xvfb lxde-core firefox-esr dbus dbus-x11 >/dev/null 2>&1 || true
        [ -e /tmp/.X1-lock ] && rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 2>/dev/null
        su -s /bin/bash kiren -c 'nohup Xvfb :1 -screen 0 1440x900x24 >/tmp/xvfb.log 2>&1 &'
        sleep 2
        su -s /bin/bash kiren -c 'nohup env DISPLAY=:1 dbus-launch --exit-with-session startlxde >/tmp/lxde.log 2>&1 &'
        sleep 4
        DISPLAY=:1 xdotool getactivewindow >/dev/null 2>&1 && echo DESKTOP_READY || echo DESKTOP_PARTIAL`);
      return boot.exit === 0 && boot.stdout.includes("DESKTOP_READY");
    } catch {
      return false;
    }
  }
}
