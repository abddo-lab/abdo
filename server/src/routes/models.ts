// server/src/routes/models.ts — /v1/models and /v1/chat/completions proxy
import { Router } from "express";
import { listModels } from "../models-registry.js";
import { ModelProxy } from "../services/model-proxy.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /v1/models — list all available models (fetched live from the model API)
router.get("/models", async (req, res) => {
  try {
    const data = await listModels();
    res.json({ object: "list", data });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// POST /v1/chat/completions — proxy to the correct provider
router.post("/chat/completions", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const threadId = req.body.thread_id;

    if (req.body.stream) {
      // Streaming response
      const stream = await ModelProxy.chatCompletionStream(req.body, userId, threadId);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Kiren-Model", req.body.model);

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(typeof value === "string" ? value : decoder.decode(value));
        }
      };
      pump().catch((err) => { console.error("Stream error:", err); res.end(); });
    } else {
      // Non-streaming response
      const result = await ModelProxy.chatCompletion(req.body, userId, threadId);
      res.json(result);
    }
  } catch (err: any) {
    console.error("Chat completion error:", err);
    res.status(500).json({ error: { message: err.message, type: "server_error" } });
  }
});

export default router;
