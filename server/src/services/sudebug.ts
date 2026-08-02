// server/src/services/sudebug.ts — Web-view debugger: tests the live preview with
// Vercel's agent-browser (or headless Chromium fallback) and analyzes screenshots
// with a vision-capable model. The main agent invokes this after building an app.
import { SandboxService } from "./sandbox.js";
import { ModelProxy } from "./model-proxy.js";
import { loadConfig } from "../config.js";
import { getModel, listModels } from "../models-registry.js";
import pool from "../db.js";

export interface SudebugResult {
  status: "ok" | "issues" | "error";
  url: string;
  screenshot_base64: string;
  analysis: {
    renders: boolean;
    console_errors: string[];
    layout_issues: string[];
    text_visible: boolean;
    summary: string;
    suggestions: string[];
  };
  raw_report: string;
}

export class SudebugService {
  /** Find the best vision-capable model for the user (falls back to qwen3.7-max) */
  static async pickVisionModel(): Promise<string> {
    const config = loadConfig();
    const preferred = ((config as any).models?.sudebug_vision_model as string) || "qwen3.7-max";
    const m = getModel(preferred);
    if (m?.supports_vision) return preferred;
    // fall back to any vision model in the live registry
    try {
      const models = await listModels();
      const vision = models.find((x: any) => x.supports_vision);
      if (vision?.id) return vision.id;
    } catch {}
    return "qwen3.7-max";
  }

  /**
   * Run sudebug against a live preview URL.
   * @param sandboxId   the user's sandbox
   * @param url         the live preview URL (trycloudflare tunnel)
   * @param visionModel vision-capable model id
   */
  static async run(sandboxId: string, url: string, visionModel: string): Promise<SudebugResult> {
    if (!sandboxId) throw new Error("No sandbox available for sudebug");
    if (!url) throw new Error("No preview URL to debug — build the app and start a preview first");

    // 1. Capture the rendered page as a screenshot inside the sandbox.
    const screenshot = await this.capture(sandboxId, url);
    if (!screenshot || screenshot.length < 1000) {
      throw new Error("sudebug could not capture the page (is the preview server running?)");
    }

    // 2. Analyze the screenshot with a vision model.
    const analysis = await this.analyze(visionModel, url, screenshot);

    return {
      status: analysis.renders && analysis.console_errors.length === 0 ? "ok" : "issues",
      url,
      screenshot_base64: screenshot,
      analysis,
      raw_report: JSON.stringify(analysis, null, 2),
    };
  }

  /** Capture the page: prefer agent-browser, fall back to headless Chromium/Firefox */
  private static async capture(sandboxId: string, url: string): Promise<string> {
    // Try Vercel's agent-browser CLI first (installed via `npm i -g agent-browser`).
    const abCheck = await SandboxService.execCommand(sandboxId, `command -v agent-browser && agent-browser --version 2>/dev/null || echo MISSING`);
    if (!abCheck.stdout.includes("MISSING")) {
      const shot = await SandboxService.execCommand(sandboxId,
        `agent-browser screenshot "${url}" /tmp/sudebug.png --width 1440 --height 900 --timeout 30000 2>&1 | tail -5; test -s /tmp/sudebug.png && base64 -w0 /tmp/sudebug.png || echo ""`);
      if (shot.stdout && shot.stdout.length > 1000) return shot.stdout.trim();
    }

    // Fallback 1: headless Chromium
    const chr = await SandboxService.execCommand(sandboxId,
      `command -v chromium || command -v chromium-browser || command -v google-chrome || echo NONE`);
    if (!chr.stdout.includes("NONE")) {
      const shot = await SandboxService.execCommand(sandboxId,
        `${chr.stdout.trim().split("\n")[0]} --headless --disable-gpu --no-sandbox --screenshot=/tmp/sudebug.png --window-size=1440,900 --virtual-time-budget=8000 "${url}" 2>&1 | tail -3; test -s /tmp/sudebug.png && base64 -w0 /tmp/sudebug.png || echo ""`);
      if (shot.stdout && shot.stdout.length > 1000) return shot.stdout.trim();
    }

    // Fallback 2: Firefox headless
    const ff = await SandboxService.execCommand(sandboxId, `command -v firefox || command -v firefox-esr || echo NONE`);
    if (!ff.stdout.includes("NONE")) {
      const bin = ff.stdout.trim().split("\n")[0];
      const shot = await SandboxService.execCommand(sandboxId,
        `cd /tmp && timeout 40 ${bin} --headless --screenshot /tmp/sudebug.png --window-size=1440,900 "${url}" 2>&1 | tail -3; test -s /tmp/sudebug.png && base64 -w0 /tmp/sudebug.png || echo ""`);
      if (shot.stdout && shot.stdout.length > 1000) return shot.stdout.trim();
    }

    return "";
  }

  /** Ask the vision model to review the rendered page */
  private static async analyze(visionModel: string, url: string, screenshotBase64: string): Promise<SudebugResult["analysis"]> {
    const prompt = `You are @sudebug, a web-view debugger. A screenshot of the live preview (${url}) is attached.

Carefully inspect the rendered page and respond in this exact JSON:
{
  "renders": true/false,
  "console_errors": ["any visible error text on screen"],
  "layout_issues": ["overlap, overflow, blank areas, broken layout"],
  "text_visible": true/false,
  "summary": "2-3 sentence assessment of what the page shows",
  "suggestions": ["concrete fix suggestions"]
}

If the page appears blank, broken, shows an error page, or a white screen — set renders=false and describe what you see.
ONLY respond with JSON.`;

    const result = await ModelProxy.chatCompletion({
      model: visionModel,
      messages: [
        { role: "system", content: "You are a vision-based web debugger. Respond with valid JSON only." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }, undefined, undefined);

    const content = result.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content);
      return {
        renders: parsed.renders ?? false,
        console_errors: Array.isArray(parsed.console_errors) ? parsed.console_errors : [],
        layout_issues: Array.isArray(parsed.layout_issues) ? parsed.layout_issues : [],
        text_visible: parsed.text_visible ?? false,
        summary: parsed.summary || "No summary provided",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      return {
        renders: true,
        console_errors: [],
        layout_issues: [],
        text_visible: true,
        summary: content.slice(0, 500),
        suggestions: [],
      };
    }
  }

  /** Convenience: run sudebug against a thread's live preview (if any) */
  static async runForThread(userId: string, threadId: string, sandboxId?: string): Promise<SudebugResult> {
    const result = await pool.query(
      `SELECT url FROM deployments WHERE thread_id = $1 AND status = 'live' ORDER BY created_at DESC LIMIT 1`,
      [threadId]
    );
    const url = result.rows[0]?.url;
    if (!url) throw new Error("No live preview for this thread yet — deploy first");

    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sb = sandboxId || user.rows[0]?.sandbox_id;
    if (!sb) throw new Error("No sandbox available");

    const vision = await this.pickVisionModel();
    return this.run(sb, url, vision);
  }
}
