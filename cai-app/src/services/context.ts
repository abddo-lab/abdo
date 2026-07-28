/**
 * Context System — codebase indexing, @ mentions, context injection
 * Inspired by Cursor's @codebase + Claude Code's context management
 */

import { githubAPI } from "./api";

export interface ContextEntry {
  path: string;
  content: string;
  relevance: number; // 0..1
  tokenCount: number;
}

export interface CodebaseIndex {
  repo: string;
  branch: string;
  files: Array<{ path: string; type: string; size: number }>;
  symbols: Array<{ name: string; kind: string; file: string; line: number }>;
  lastIndexed: number;
}

// In-memory index
let currentIndex: CodebaseIndex | null = null;

// Estimate tokens (rough: 4 chars ≈ 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Index a codebase from GitHub
export async function indexCodebase(token: string, owner: string, repo: string, branch: string): Promise<CodebaseIndex> {
  const files: CodebaseIndex["files"] = [];
  const symbols: CodebaseIndex["symbols"] = [];

  async function walkDir(path: string) {
    try {
      const entries = await githubAPI.getFiles(token, owner, repo, path, branch);
      for (const entry of entries) {
        if (entry.type === "dir") {
          // Skip node_modules, .git, dist
          if (!["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) {
            await walkDir(entry.path);
          }
        } else {
          files.push({ path: entry.path, type: entry.name.split(".").pop() ?? "", size: entry.size ?? 0 });
          // Extract symbols from code files
          if (["ts", "tsx", "js", "jsx"].includes(entry.name.split(".").pop() ?? "")) {
            try {
              const content = await githubAPI.getFileContent(token, owner, repo, entry.path, branch);
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Function declarations
                const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
                if (fnMatch) symbols.push({ name: fnMatch[1], kind: "function", file: entry.path, line: i + 1 });
                // Const/arrow functions
                const constMatch = line.match(/(?:export\s+)?const\s+(\w+)\s*=/);
                if (constMatch) symbols.push({ name: constMatch[1], kind: "const", file: entry.path, line: i + 1 });
                // Class declarations
                const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
                if (classMatch) symbols.push({ name: classMatch[1], kind: "class", file: entry.path, line: i + 1 });
                // Interface declarations
                const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
                if (ifaceMatch) symbols.push({ name: ifaceMatch[1], kind: "interface", file: entry.path, line: i + 1 });
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  await walkDir("");
  currentIndex = { repo: `${owner}/${repo}`, branch, files, symbols, lastIndexed: Date.now() };
  return currentIndex;
}

export function getCurrentIndex(): CodebaseIndex | null {
  return currentIndex;
}

// Search the index
export function searchCodebase(query: string): Array<{ type: "file" | "symbol"; name: string; path: string; line?: number; match: string }> {
  if (!currentIndex) return [];
  const q = query.toLowerCase();
  const results: Array<{ type: "file" | "symbol"; name: string; path: string; line?: number; match: string }> = [];

  // Search files
  for (const f of currentIndex.files) {
    if (f.path.toLowerCase().includes(q)) {
      results.push({ type: "file", name: f.path.split("/").pop() ?? "", path: f.path, match: f.path });
    }
  }

  // Search symbols
  for (const s of currentIndex.symbols) {
    if (s.name.toLowerCase().includes(q)) {
      results.push({ type: "symbol", name: s.name, path: s.file, line: s.line, match: `${s.kind} ${s.name} at ${s.file}:${s.line}` });
    }
  }

  return results.slice(0, 50);
}

// Build context for a query — find relevant files
export async function buildContextForQuery(
  query: string,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  maxTokens = 4000
): Promise<ContextEntry[]> {
  const entries: ContextEntry[] = [];
  let totalTokens = 0;

  // Search index for relevant files
  const results = searchCodebase(query);
  const relevantPaths = [...new Set(results.map((r) => r.path))].slice(0, 10);

  for (const path of relevantPaths) {
    if (totalTokens >= maxTokens) break;
    try {
      const content = await githubAPI.getFileContent(token, owner, repo, path, branch);
      const tokens = estimateTokens(content);
      const truncated = totalTokens + tokens > maxTokens ? content.slice(0, (maxTokens - totalTokens) * 4) : content;
      entries.push({ path, content: truncated, relevance: 1, tokenCount: estimateTokens(truncated) });
      totalTokens += estimateTokens(truncated);
    } catch {}
  }

  return entries;
}

// Build context block for system prompt
export function buildContextBlock(entries: ContextEntry[]): string {
  if (entries.length === 0) return "";
  let block = "<codebase_context>\n";
  for (const e of entries) {
    block += `### ${e.path}\n\`\`\`\n${e.content}\n\`\`\`\n\n`;
  }
  block += "</codebase_context>\n";
  return block;
}
