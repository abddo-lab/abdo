// server/src/services/code-analysis.ts — Code Analysis Engine: AST, dependencies, complexity
import { SandboxService } from "./sandbox.js";

export interface FileAnalysis {
  path: string;
  language: string;
  lines: number;
  functions: { name: string; line: number; params: number; complexity: number }[];
  exports: string[];
  imports: { source: string; names: string[] }[];
  complexity: number;      // cyclomatic complexity estimate
  maintainability: number; // 0-100 score
  issues: { line: number; severity: "error" | "warning" | "info"; message: string }[];
}

export interface DependencyGraph {
  nodes: { id: string; label: string; type: "file" | "module" }[];
  edges: { from: string; to: string; type: "import" | "require" }[];
  circular: string[][];    // circular dependency chains
}

export interface ProjectHealth {
  score: number;           // 0-100
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  avgComplexity: number;
  hotspots: { file: string; issues: number; complexity: number }[];
  testCoverage: number | null;
  recommendations: string[];
}

export class CodeAnalysisService {
  /** Analyze a single file */
  static async analyzeFile(sandboxId: string, path: string): Promise<FileAnalysis> {
    const content = await SandboxService.execCommand(sandboxId, `cat "${path}"`);
    const lines = content.stdout.split("\n");
    const language = this.detectLanguage(path);

    const analysis: FileAnalysis = {
      path,
      language,
      lines: lines.length,
      functions: this.extractFunctions(lines, language),
      exports: this.extractExports(lines, language),
      imports: this.extractImports(lines, language),
      complexity: this.estimateComplexity(lines),
      maintainability: 0,
      issues: this.findIssues(lines, language, path),
    };

    // Calculate maintainability score
    analysis.maintainability = this.calculateMaintainability(analysis);

    return analysis;
  }

  /** Analyze entire project */
  static async analyzeProject(sandboxId: string, rootPath = "."): Promise<ProjectHealth> {
    // Get file tree
    const treeResult = await SandboxService.execCommand(
      sandboxId,
      `find ${rootPath} -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" 2>/dev/null | head -200`
    );

    const files = treeResult.stdout.split("\n").filter(Boolean);
    const languages: Record<string, number> = {};
    let totalLines = 0;
    let totalComplexity = 0;
    const hotspots: { file: string; issues: number; complexity: number }[] = [];
    const recommendations: string[] = [];

    for (const file of files.slice(0, 50)) { // Limit to 50 files for performance
      try {
        const analysis = await this.analyzeFile(sandboxId, file);
        languages[analysis.language] = (languages[analysis.language] || 0) + 1;
        totalLines += analysis.lines;
        totalComplexity += analysis.complexity;

        if (analysis.issues.length > 3 || analysis.complexity > 15) {
          hotspots.push({ file, issues: analysis.issues.length, complexity: analysis.complexity });
        }
      } catch {}
    }

    // Generate recommendations
    const avgComplexity = files.length > 0 ? totalComplexity / files.length : 0;
    if (avgComplexity > 10) recommendations.push("Average complexity is high — consider refactoring complex functions");
    if (hotspots.length > 5) recommendations.push(`${hotspots.length} files have high complexity or many issues — prioritize cleanup`);
    if (totalLines > 50000) recommendations.push("Large codebase — consider splitting into packages/modules");

    // Check for test files
    const testCount = files.filter((f) => f.includes("test") || f.includes("spec") || f.includes("__tests__")).length;
    const testRatio = files.length > 0 ? testCount / files.length : 0;
    if (testRatio < 0.2) recommendations.push("Low test coverage — add more tests");

    return {
      score: Math.max(0, Math.min(100, 100 - hotspots.length * 5 - (avgComplexity > 10 ? 15 : 0))),
      totalFiles: files.length,
      totalLines,
      languages,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      hotspots: hotspots.sort((a, b) => b.complexity - a.complexity).slice(0, 10),
      testCoverage: null,
      recommendations,
    };
  }

  /** Build dependency graph */
  static async buildDependencyGraph(sandboxId: string, rootPath = "."): Promise<DependencyGraph> {
    const treeResult = await SandboxService.execCommand(
      sandboxId,
      `find ${rootPath} -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -100`
    );

    const files = treeResult.stdout.split("\n").filter(Boolean);
    const nodes: DependencyGraph["nodes"] = [];
    const edges: DependencyGraph["edges"] = [];

    for (const file of files) {
      const content = await SandboxService.execCommand(sandboxId, `cat "${file}"`);
      const imports = this.extractImports(content.stdout.split("\n"), this.detectLanguage(file));

      nodes.push({ id: file, label: file.split("/").pop() || file, type: "file" });

      for (const imp of imports) {
        if (imp.source.startsWith(".")) {
          edges.push({ from: file, to: imp.source, type: "import" });
        }
      }
    }

    // Detect circular dependencies (simplified)
    const circular: string[][] = [];
    const visited = new Set<string>();
    const adjList = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjList.has(edge.from)) adjList.set(edge.from, []);
      adjList.get(edge.from)!.push(edge.to);
    }

    return { nodes, edges, circular };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private static detectLanguage(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      py: "python", go: "go", rs: "rust", rb: "ruby", java: "java",
      css: "css", html: "html", json: "json", md: "markdown",
    };
    return map[ext] || "unknown";
  }

  private static extractFunctions(lines: string[], lang: string): FileAnalysis["functions"] {
    const functions: FileAnalysis["functions"] = [];
    const patterns: Record<string, RegExp> = {
      typescript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
      javascript: /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
      python: /def\s+(\w+)\s*\(/,
      go: /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
      rust: /fn\s+(\w+)\s*[(<]/,
    };

    const pattern = patterns[lang] || patterns.typescript;
    lines.forEach((line, idx) => {
      const match = line.match(pattern);
      if (match) {
        const name = match[1] || match[2];
        if (name) {
          const params = (line.match(/,/g) || []).length + 1;
          const complexity = (line.match(/if|else|for|while|switch|catch|\?/g) || []).length + 1;
          functions.push({ name, line: idx + 1, params: Math.min(params, 10), complexity });
        }
      }
    });

    return functions;
  }

  private static extractExports(lines: string[], lang: string): string[] {
    const exports: string[] = [];
    for (const line of lines) {
      const match = line.match(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/);
      if (match) exports.push(match[1]);
    }
    return exports;
  }

  private static extractImports(lines: string[], lang: string): FileAnalysis["imports"] {
    const imports: FileAnalysis["imports"] = [];
    for (const line of lines) {
      const match = line.match(/import\s+.*from\s+['"]([^'"]+)['"]/);
      if (match) {
        const names: string[] = [];
        const namedMatch = line.match(/\{([^}]+)\}/);
        if (namedMatch) names.push(...namedMatch[1].split(",").map((n) => n.trim()));
        const defaultMatch = line.match(/import\s+(\w+)\s+from/);
        if (defaultMatch) names.push(defaultMatch[1]);
        imports.push({ source: match[1], names });
      }
    }
    return imports;
  }

  private static estimateComplexity(lines: string[]): number {
    let complexity = 1;
    for (const line of lines) {
      const keywords = line.match(/\b(if|else|for|while|switch|case|catch|&&|\|\||\?)\b/g);
      if (keywords) complexity += keywords.length;
    }
    return complexity;
  }

  private static findIssues(lines: string[], lang: string, path: string): FileAnalysis["issues"] {
    const issues: FileAnalysis["issues"] = [];

    lines.forEach((line, idx) => {
      // Long lines
      if (line.length > 120) {
        issues.push({ line: idx + 1, severity: "warning", message: `Line too long (${line.length} chars)` });
      }

      // TODO/FIXME/HACK
      if (line.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/i)) {
        issues.push({ line: idx + 1, severity: "info", message: "Contains TODO/FIXME comment" });
      }

      // Console.log in non-test files
      if (!path.includes("test") && line.match(/console\.(log|warn|error)/)) {
        issues.push({ line: idx + 1, severity: "info", message: "Console statement found" });
      }

      // Any type in TypeScript
      if (lang === "typescript" && line.match(/:\s*any\b/)) {
        issues.push({ line: idx + 1, severity: "warning", message: "Using 'any' type" });
      }

      // Empty catch
      if (line.match(/catch\s*\(\w*\)\s*\{\s*\}/)) {
        issues.push({ line: idx + 1, severity: "warning", message: "Empty catch block" });
      }
    });

    return issues;
  }

  private static calculateMaintainability(analysis: FileAnalysis): number {
    let score = 100;
    score -= Math.max(0, analysis.complexity - 10) * 2;
    score -= analysis.issues.filter((i) => i.severity === "error").length * 10;
    score -= analysis.issues.filter((i) => i.severity === "warning").length * 3;
    score -= analysis.issues.filter((i) => i.severity === "info").length * 1;
    score -= analysis.lines > 500 ? 10 : 0;
    return Math.max(0, Math.min(100, score));
  }
}
