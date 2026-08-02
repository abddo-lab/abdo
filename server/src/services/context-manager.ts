// server/src/services/context-manager.ts — Smart context window management
import { SandboxService } from "./sandbox.js";

export interface ContextChunk {
  type: "file" | "diff" | "error" | "test" | "log" | "memory";
  path?: string;
  content: string;
  tokens: number;
  priority: number;   // 1-10, higher = more important
  relevance: number;  // 0-100, how relevant to current task
}

export interface ContextWindow {
  chunks: ContextChunk[];
  totalTokens: number;
  maxTokens: number;
  utilization: number; // percentage used
}

export class ContextManager {
  private maxTokens: number;
  private chunks: ContextChunk[] = [];

  constructor(maxTokens = 100000) {
    this.maxTokens = maxTokens;
  }

  /** Add a chunk to context */
  add(chunk: ContextChunk): boolean {
    const tokens = this.estimateTokens(chunk.content);
    chunk.tokens = tokens;

    if (this.totalTokens() + tokens > this.maxTokens) {
      // Try to make room by removing low-priority chunks
      this.evict(tokens);
    }

    if (this.totalTokens() + tokens <= this.maxTokens) {
      this.chunks.push(chunk);
      return true;
    }
    return false;
  }

  /** Add file content */
  addFile(path: string, content: string, priority = 5, relevance = 50): boolean {
    return this.add({ type: "file", path, content, tokens: 0, priority, relevance });
  }

  /** Add diff */
  addDiff(path: string, diff: string, priority = 7): boolean {
    return this.add({ type: "diff", path, content: diff, tokens: 0, priority, relevance: 80 });
  }

  /** Add error message */
  addError(error: string, priority = 8): boolean {
    return this.add({ type: "error", content: error, tokens: 0, priority, relevance: 90 });
  }

  /** Add test output */
  addTestOutput(output: string, priority = 6): boolean {
    return this.add({ type: "test", content: output, tokens: 0, priority, relevance: 70 });
  }

  /** Add memory/insight */
  addMemory(memory: string, priority = 4): boolean {
    return this.add({ type: "memory", content: memory, tokens: 0, priority, relevance: 60 });
  }

  /** Get the context as a formatted string for LLM */
  getContext(): string {
    // Sort by priority * relevance
    const sorted = [...this.chunks].sort(
      (a, b) => (b.priority * b.relevance) - (a.priority * a.relevance)
    );

    let context = "";
    for (const chunk of sorted) {
      switch (chunk.type) {
        case "file":
          context += `### File: ${chunk.path}\n\`\`\`\n${chunk.content}\n\`\`\`\n\n`;
          break;
        case "diff":
          context += `### Diff: ${chunk.path}\n\`\`\`diff\n${chunk.content}\n\`\`\`\n\n`;
          break;
        case "error":
          context += `### Error\n${chunk.content}\n\n`;
          break;
        case "test":
          context += `### Test Output\n\`\`\`\n${chunk.content}\n\`\`\`\n\n`;
          break;
        case "memory":
          context += `### Memory\n${chunk.content}\n\n`;
          break;
        case "log":
          context += `### Log\n${chunk.content}\n\n`;
          break;
      }
    }

    return context;
  }

  /** Get context window stats */
  getWindow(): ContextWindow {
    return {
      chunks: [...this.chunks],
      totalTokens: this.totalTokens(),
      maxTokens: this.maxTokens,
      utilization: Math.round((this.totalTokens() / this.maxTokens) * 100),
    };
  }

  /** Load relevant files from sandbox */
  async loadRelevantFiles(sandboxId: string, goal: string, maxFiles = 10): Promise<void> {
    // Get file tree
    const treeResult = await SandboxService.execCommand(
      sandboxId,
      `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" 2>/dev/null | head -100`
    );

    const files = treeResult.stdout.split("\n").filter(Boolean);
    const goalLower = goal.toLowerCase();
    const goalWords = goalLower.split(/\s+/).filter((w) => w.length > 3);

    // Score files by relevance to goal
    const scored = files.map((file) => {
      let score = 0;
      const fileLower = file.toLowerCase();

      // File name matches goal words
      for (const word of goalWords) {
        if (fileLower.includes(word)) score += 20;
      }

      // Test files relevant if goal mentions testing
      if (goalLower.includes("test") && (fileLower.includes("test") || fileLower.includes("spec"))) {
        score += 30;
      }

      // Config files relevant if goal mentions config
      if (goalLower.includes("config") && fileLower.includes("config")) {
        score += 25;
      }

      // Entry points always somewhat relevant
      if (fileLower.match(/(index|main|app)\.(ts|tsx|js|jsx)$/)) {
        score += 10;
      }

      return { file, score };
    });

    // Load top N most relevant files
    scored.sort((a, b) => b.score - a.score);
    for (const { file } of scored.slice(0, maxFiles)) {
      try {
        const content = await SandboxService.execCommand(sandboxId, `cat "${file}"`);
        if (content.stdout.length < 10000) { // Skip very large files
          this.addFile(file, content.stdout, 5, Math.max(30, 100 - scored.indexOf({ file, score: 0 }) * 5));
        }
      } catch {}
    }
  }

  /** Clear all chunks */
  clear(): void {
    this.chunks = [];
  }

  private totalTokens(): number {
    return this.chunks.reduce((sum, c) => sum + c.tokens, 0);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private evict(neededTokens: number): void {
    // Sort by priority * relevance (lowest first)
    this.chunks.sort((a, b) => (a.priority * a.relevance) - (b.priority * b.relevance));

    while (this.totalTokens() + neededTokens > this.maxTokens && this.chunks.length > 0) {
      this.chunks.shift();
    }
  }
}
