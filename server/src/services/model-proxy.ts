// server/src/services/model-proxy.ts — ALL models route through config.models.base_url
import { loadConfig } from "../config.js";
import { getModel, getAvailableModelIds, type ModelDef } from "../models-registry.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { UsageService } from "./usage.js";

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | MessageContentPart[];
  tool_call_id?: string;
  name?: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: any[];
  tool_choice?: any;
}

export class ModelProxy {
  /** Route chat completion through the configured model API */
  static async chatCompletion(req: ChatRequest, userId?: string, threadId?: string): Promise<any> {
    // Enforce money-based usage limits before spending the user's balance
    if (userId) await UsageService.enforce(userId);

    // Validate against the LIVE model list from the API (not a hardcoded registry)
    const available = await getAvailableModelIds();
    if (!available.includes(req.model)) {
      throw new Error(`Model '${req.model}' not available`);
    }
    const model = getModel(req.model);

    const config = loadConfig();
    const baseUrl = config.models.base_url;
    const apiKey = config.models.api_key;

    if (!apiKey || apiKey.startsWith("REPLACE")) {
      throw new Error("API key not configured. Set models.api_key in config.json");
    }

    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: false,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        tools: req.tools,
        tool_choice: req.tool_choice,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`(${response.status}): ${errText}`);
    }

    const result = await response.json();
    const latencyMs = Date.now() - startTime;

    // Calculate usage + cost
    const inputTokens = result.usage?.prompt_tokens || this.estimateTokens(req.messages.map((m) => typeof m.content === "string" ? m.content : m.content.map((p) => p.type === "text" ? p.text : "[image]").join(" ")).join(""));
    const outputTokens = result.usage?.completion_tokens || this.estimateTokens(result.choices?.[0]?.message?.content || "");
    const costUsd = this.calculateCost(model, inputTokens, outputTokens);

    // Record usage + deduct balance
    if (userId) {
      await this.recordUsage({ userId, threadId, modelId: model.id, inputTokens, outputTokens, costUsd });
    }

    return {
      id: result.id || `chatcmpl-${uuid().slice(0, 8)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model.id,
      choices: result.choices || [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "stop" }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      _kiren: { latency_ms: latencyMs, cost_usd: costUsd },
    };
  }

  /** Stream chat completion through kiren.knr.cl/v1 */
  static async chatCompletionStream(req: ChatRequest, userId?: string, threadId?: string): Promise<ReadableStream> {
    // Enforce money-based usage limits before spending the user's balance
    if (userId) await UsageService.enforce(userId);

    const model = getModel(req.model);
    if (!model) throw new Error(`Model '${req.model}' not found`);

    const config = loadConfig();
    const baseUrl = config.models.base_url;
    const apiKey = config.models.api_key;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: true,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        tools: req.tools,
        tool_choice: req.tool_choice,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${errText}`);
    }

    const encoder = new TextEncoder();
    let totalInput = 0;
    let totalOutput = 0;

    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) { controller.close(); return; }
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                if (userId && (totalInput > 0 || totalOutput > 0)) {
                  const costUsd = ModelProxy.calculateCost(model, totalInput, totalOutput);
                  await ModelProxy.recordUsage({ userId, threadId, modelId: model.id, inputTokens: totalInput, outputTokens: totalOutput, costUsd });
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.usage) {
                  totalInput = parsed.usage.prompt_tokens || totalInput;
                  totalOutput = parsed.usage.completion_tokens || totalOutput;
                }
                parsed.model = model.id;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              } catch {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
          }
        } catch (err) { controller.error(err); }
        finally { controller.close(); }
      },
    });
  }

  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private static calculateCost(model: ModelDef, inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1_000_000) * model.cost_per_1m_input + (outputTokens / 1_000_000) * model.cost_per_1m_output;
  }

  private static async recordUsage(rec: { userId: string; threadId?: string; modelId: string; inputTokens: number; outputTokens: number; costUsd: number }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO usage (id, user_id, thread_id, model_id, feature, input_tokens, output_tokens, cost_usd)
         VALUES ($1, $2, $3, $4, 'chat', $5, $6, $7)`,
        [uuid(), rec.userId, rec.threadId, rec.modelId, rec.inputTokens, rec.outputTokens, rec.costUsd]
      );
      if (rec.costUsd > 0) {
        await pool.query(`UPDATE users SET balance = GREATEST(0, balance - $1), updated_at = NOW() WHERE id = $2`, [rec.costUsd, rec.userId]);
      }
      if (rec.threadId) {
        await pool.query(
          `UPDATE threads SET tokens_used = tokens_used + $1, cost_usd = cost_usd + $2, updated_at = NOW() WHERE id = $3`,
          [rec.inputTokens + rec.outputTokens, rec.costUsd, rec.threadId]
        );
      }
    } catch (err) { console.error("Usage record failed:", err); }
  }
}
