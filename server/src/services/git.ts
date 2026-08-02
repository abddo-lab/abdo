// server/src/services/git.ts — Real Git operations in sandbox
import { SandboxService } from "./sandbox.js";

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
}

export interface GitLog {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: { header: string; lines: { type: "+" | "-" | " "; text: string }[] }[];
}

export class GitService {
  /** Get current status */
  static async status(sandboxId: string): Promise<GitStatus> {
    const branch = await SandboxService.execCommand(sandboxId, "git rev-parse --abbrev-ref HEAD 2>/dev/null");
    const statusResult = await SandboxService.execCommand(sandboxId, "git status --porcelain=v2 --branch 2>/dev/null");
    const lines = statusResult.stdout.split("\n").filter(Boolean);

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    let ahead = 0, behind = 0;

    for (const line of lines) {
      const aheadMatch = line.match(/ahead (\d+)/);
      const behindMatch = line.match(/behind (\d+)/);
      if (aheadMatch) ahead = parseInt(aheadMatch[1]);
      if (behindMatch) behind = parseInt(behindMatch[1]);

      if (line.startsWith("1 ") || line.startsWith("2 ")) {
        const parts = line.split(" ");
        const xy = parts[1];
        const path = parts.slice(8).join(" ");
        if (xy[0] !== "." && xy[0] !== "?") staged.push(path);
        if (xy[1] !== "." && xy[1] !== "?") modified.push(path);
        if (xy === "??") untracked.push(path);
        if (xy[0] === "U" || xy[1] === "U") conflicted.push(path);
      }
    }

    return { branch: branch.stdout.trim(), ahead, behind, staged, modified, untracked, conflicted };
  }

  /** Get git log */
  static async log(sandboxId: string, limit = 20): Promise<GitLog[]> {
    const result = await SandboxService.execCommand(
      sandboxId,
      `git log --oneline --format="%H|%an|%ai|%s" -${limit} 2>/dev/null`
    );

    return result.stdout.split("\n").filter(Boolean).map((line) => {
      const [hash, author, date, ...msgParts] = line.split("|");
      return { hash, author, date, message: msgParts.join("|") };
    });
  }

  /** Get diff for specific files or all */
  static async diff(sandboxId: string, files?: string[]): Promise<GitDiff[]> {
    const cmd = files ? `git diff --stat ${files.join(" ")}` : "git diff --stat";
    const result = await SandboxService.execCommand(sandboxId, cmd);
    const diffs: GitDiff[] = [];

    const diffLines = result.stdout.split("\n").filter(Boolean);
    for (const line of diffLines) {
      const match = line.match(/(.+)\s+\|\s+(\d+)\s+([+-]+)/);
      if (match) {
        const adds = (match[3].match(/\+/g) || []).length;
        const dels = (match[3].match(/-/g) || []).length;
        diffs.push({ file: match[1].trim(), additions: adds, deletions: dels, hunks: [] });
      }
    }

    return diffs;
  }

  /** Create a commit */
  static async commit(sandboxId: string, message: string, files?: string[]): Promise<string> {
    if (files) {
      await SandboxService.execCommand(sandboxId, `git add ${files.join(" ")}`);
    } else {
      await SandboxService.execCommand(sandboxId, "git add -A");
    }
    const result = await SandboxService.execCommand(sandboxId, `git commit -m "${message.replace(/"/g, '\\"')}" 2>&1`);
    return result.stdout;
  }

  /** Create a branch */
  static async createBranch(sandboxId: string, name: string): Promise<string> {
    const result = await SandboxService.execCommand(sandboxId, `git checkout -b ${name} 2>&1`);
    return result.stdout;
  }

  /** Switch branch */
  static async switchBranch(sandboxId: string, name: string): Promise<string> {
    const result = await SandboxService.execCommand(sandboxId, `git checkout ${name} 2>&1`);
    return result.stdout;
  }

  /** List branches */
  static async branches(sandboxId: string): Promise<{ name: string; current: boolean; remote: boolean }[]> {
    const result = await SandboxService.execCommand(sandboxId, "git branch -a 2>/dev/null");
    return result.stdout.split("\n").filter(Boolean).map((line) => ({
      name: line.replace(/^\*?\s+/, "").trim(),
      current: line.startsWith("*"),
      remote: line.includes("remotes/"),
    }));
  }

  /** Stash changes */
  static async stash(sandboxId: string, message?: string): Promise<string> {
    const cmd = message ? `git stash push -m "${message}"` : "git stash";
    const result = await SandboxService.execCommand(sandboxId, `${cmd} 2>&1`);
    return result.stdout;
  }

  /** Clone a repo */
  static async clone(sandboxId: string, url: string, dest?: string): Promise<string> {
    const result = await SandboxService.execCommand(sandboxId, `git clone ${url} ${dest || ""} 2>&1`);
    return result.stdout;
  }

  /** Get file blame */
  static async blame(sandboxId: string, file: string): Promise<{ line: number; author: string; content: string }[]> {
    const result = await SandboxService.execCommand(sandboxId, `git blame --porcelain ${file} 2>/dev/null`);
    const lines = result.stdout.split("\n").filter(Boolean);
    const blameEntries: { line: number; author: string; content: string }[] = [];

    let currentAuthor = "";
    let currentLine = 0;
    for (const line of lines) {
      if (line.startsWith("author ")) currentAuthor = line.slice(7);
      if (line.match(/^\t/)) {
        currentLine++;
        blameEntries.push({ line: currentLine, author: currentAuthor, content: line.slice(1) });
      }
    }

    return blameEntries;
  }
}
