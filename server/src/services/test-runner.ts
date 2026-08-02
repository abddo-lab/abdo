// server/src/services/test-runner.ts — Real test execution with coverage tracking
import { SandboxService } from "./sandbox.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export interface TestResult {
  framework: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  coverage: { lines: number; functions: number; branches: number; statements: number } | null;
  failures: { file: string; test: string; error: string; line?: number }[];
  stdout: string;
}

export class TestRunnerService {
  /** Detect test framework in sandbox */
  static async detectFramework(sandboxId: string): Promise<string> {
    const checks = [
      { cmd: "cat package.json 2>/dev/null | grep -o vitest", framework: "vitest" },
      { cmd: "cat package.json 2>/dev/null | grep -o jest", framework: "jest" },
      { cmd: "cat package.json 2>/dev/null | grep -o mocha", framework: "mocha" },
      { cmd: "ls pytest.ini pyproject.toml setup.cfg 2>/dev/null | head -1", framework: "pytest" },
      { cmd: "ls go.mod 2>/dev/null", framework: "go test" },
      { cmd: "ls Cargo.toml 2>/dev/null", framework: "cargo test" },
    ];

    for (const check of checks) {
      const result = await SandboxService.execCommand(sandboxId, check.cmd);
      if (result.stdout.trim()) return check.framework;
    }
    return "unknown";
  }

  /** Run tests */
  static async run(sandboxId: string, pattern?: string): Promise<TestResult> {
    const framework = await this.detectFramework(sandboxId);
    let cmd = "";

    switch (framework) {
      case "vitest":
        cmd = `cd /workspace && npx vitest run ${pattern || ""} --reporter=json 2>/dev/null || npx vitest run ${pattern || ""}`;
        break;
      case "jest":
        cmd = `cd /workspace && npx jest ${pattern || ""} --json 2>/dev/null || npx jest ${pattern || ""}`;
        break;
      case "pytest":
        cmd = `cd /workspace && python -m pytest ${pattern || ""} -v --tb=short 2>&1`;
        break;
      case "go test":
        cmd = `cd /workspace && go test ./... -v -count=1 2>&1`;
        break;
      case "cargo test":
        cmd = `cd /workspace && cargo test 2>&1`;
        break;
      default:
        cmd = `cd /workspace && npm test 2>&1`;
    }

    const startTime = Date.now();
    const result = await SandboxService.execCommand(sandboxId, cmd);
    const duration = Date.now() - startTime;
    const stdout = result.stdout + (result.stderr || "");

    return this.parseOutput(stdout, framework, duration);
  }

  /** Run tests for specific files changed */
  static async runChanged(sandboxId: string, changedFiles: string[]): Promise<TestResult> {
    const testFiles = changedFiles.filter((f) => f.includes("test") || f.includes("spec"));
    if (testFiles.length > 0) {
      return this.run(sandboxId, testFiles.join(" "));
    }

    // Find related test files
    const relatedTests: string[] = [];
    for (const file of changedFiles) {
      const testPath = file.replace(/\.(ts|tsx|js|jsx)$/, ".test.$1").replace("src/", "src/__tests__/");
      const specPath = file.replace(/\.(ts|tsx|js|jsx)$/, ".spec.$1");
      relatedTests.push(testPath, specPath);
    }

    return this.run(sandboxId);
  }

  /** Get coverage report */
  static async getCoverage(sandboxId: string): Promise<any> {
    const framework = await this.detectFramework(sandboxId);
    let cmd = "";

    switch (framework) {
      case "vitest":
        cmd = "cd /workspace && npx vitest run --coverage 2>&1";
        break;
      case "jest":
        cmd = "cd /workspace && npx jest --coverage 2>&1";
        break;
      default:
        return null;
    }

    const result = await SandboxService.execCommand(sandboxId, cmd);
    return this.parseCoverage(result.stdout);
  }

  /** Save test results to thread */
  static async saveToThread(threadId: string, result: TestResult): Promise<void> {
    const maxOrder = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM thread_blocks WHERE thread_id = $1`,
      [threadId]
    );

    await pool.query(
      `INSERT INTO thread_blocks (id, thread_id, kind, data, sort_order) VALUES ($1, $2, 'terminal', $3, $4)`,
      [
        uuid(), threadId,
        JSON.stringify({
          cmd: `test suite (${result.framework})`,
          exit: result.failed > 0 ? 1 : 0,
          lines: result.stdout.split("\n").slice(0, 30),
        }),
        maxOrder.rows[0].next,
      ]
    );
  }

  private static parseOutput(stdout: string, framework: string, duration: number): TestResult {
    const result: TestResult = {
      framework,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration_ms: duration,
      coverage: null,
      failures: [],
      stdout,
    };

    // Parse vitest/jest output
    const passMatch = stdout.match(/(\d+)\s+pass/i);
    const failMatch = stdout.match(/(\d+)\s+fail/i);
    const skipMatch = stdout.match(/(\d+)\s+skip/i);
    const totalMatch = stdout.match(/Tests\s+(\d+)\s+total/i);

    if (passMatch) result.passed = parseInt(passMatch[1]);
    if (failMatch) result.failed = parseInt(failMatch[1]);
    if (skipMatch) result.skipped = parseInt(skipMatch[1]);
    if (totalMatch) result.total = parseInt(totalMatch[1]);
    if (result.total === 0) result.total = result.passed + result.failed + result.skipped;

    // Parse pytest output
    const pytestMatch = stdout.match(/(\d+) passed.*?(\d+) failed/);
    if (pytestMatch && framework === "pytest") {
      result.passed = parseInt(pytestMatch[1]);
      result.failed = parseInt(pytestMatch[2]);
      result.total = result.passed + result.failed;
    }

    // Parse go test
    if (framework === "go test") {
      const goPass = stdout.match(/--- PASS/g);
      const goFail = stdout.match(/--- FAIL/g);
      result.passed = goPass ? goPass.length : 0;
      result.failed = goFail ? goFail.length : 0;
      result.total = result.passed + result.failed;
    }

    // Extract failures
    const failLines = stdout.match(/(FAIL|✗|✕|×).*$/gm) || [];
    for (const line of failLines.slice(0, 10)) {
      result.failures.push({ file: "", test: line.trim(), error: "" });
    }

    // Parse JSON output if available
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        if (json.numPassedTests) result.passed = json.numPassedTests;
        if (json.numFailedTests) result.failed = json.numFailedTests;
        if (json.numTotalTests) result.total = json.numTotalTests;
      }
    } catch {}

    return result;
  }

  private static parseCoverage(stdout: string): any {
    const coverageMatch = stdout.match(/(\d+\.?\d*)%.*?(\d+\.?\d*)%.*?(\d+\.?\d*)%.*?(\d+\.?\d*)%/);
    if (coverageMatch) {
      return {
        lines: parseFloat(coverageMatch[1]),
        functions: parseFloat(coverageMatch[2]),
        branches: parseFloat(coverageMatch[3]),
        statements: parseFloat(coverageMatch[4]),
      };
    }
    return null;
  }
}
