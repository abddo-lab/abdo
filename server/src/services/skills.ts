// server/src/services/skills.ts — Agent Skills System: learn, store, reuse, share
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: "coding" | "testing" | "devops" | "analysis" | "design" | "custom";
  trigger_patterns: string[];    // patterns that activate this skill
  system_prompt: string;         // injected into agent context
  tools_required: string[];      // tools this skill needs
  examples: SkillExample[];      // few-shot examples
  success_criteria: string;      // how to verify skill worked
  max_steps: number;             // step budget for this skill
  enabled: boolean;
  usage_count: number;
  success_rate: number;          // 0-100
  avg_steps: number;
  created_at: string;
  updated_at: string;
}

export interface SkillExample {
  input: string;
  steps: string[];
  output: string;
}

export interface SkillResult {
  skill: Skill;
  confidence: number;
  reason: string;
}

export class SkillsService {
  /** Create a new skill */
  static async create(userId: string, data: Partial<Skill>): Promise<Skill> {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO agent_skills (id, user_id, name, description, category, trigger_patterns, system_prompt, tools_required, examples, success_criteria, max_steps, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING *`,
      [
        id, userId, data.name, data.description, data.category || "custom",
        JSON.stringify(data.trigger_patterns || []),
        data.system_prompt || "",
        JSON.stringify(data.tools_required || []),
        JSON.stringify(data.examples || []),
        data.success_criteria || "",
        data.max_steps || 20,
      ]
    );
    return this.parseRow(result.rows[0]);
  }

  /** List user's skills */
  static async list(userId: string): Promise<Skill[]> {
    const result = await pool.query(
      `SELECT * FROM agent_skills WHERE user_id = $1 ORDER BY usage_count DESC, created_at DESC`,
      [userId]
    );
    return result.rows.map(this.parseRow);
  }

  /** Get a skill by ID */
  static async get(skillId: string): Promise<Skill | null> {
    const result = await pool.query(`SELECT * FROM agent_skills WHERE id = $1`, [skillId]);
    return result.rows[0] ? this.parseRow(result.rows[0]) : null;
  }

  /** Update a skill */
  static async update(skillId: string, userId: string, data: Partial<Skill>): Promise<Skill | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.system_prompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(data.system_prompt); }
    if (data.trigger_patterns !== undefined) { fields.push(`trigger_patterns = $${idx++}`); values.push(JSON.stringify(data.trigger_patterns)); }
    if (data.tools_required !== undefined) { fields.push(`tools_required = $${idx++}`); values.push(JSON.stringify(data.tools_required)); }
    if (data.examples !== undefined) { fields.push(`examples = $${idx++}`); values.push(JSON.stringify(data.examples)); }
    if (data.success_criteria !== undefined) { fields.push(`success_criteria = $${idx++}`); values.push(data.success_criteria); }
    if (data.max_steps !== undefined) { fields.push(`max_steps = $${idx++}`); values.push(data.max_steps); }
    if (data.enabled !== undefined) { fields.push(`enabled = $${idx++}`); values.push(data.enabled); }

    if (fields.length === 0) return this.get(skillId);

    fields.push(`updated_at = NOW()`);
    values.push(skillId, userId);

    const result = await pool.query(
      `UPDATE agent_skills SET ${fields.join(", ")} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] ? this.parseRow(result.rows[0]) : null;
  }

  /** Delete a skill */
  static async delete(skillId: string, userId: string): Promise<void> {
    await pool.query(`DELETE FROM agent_skills WHERE id = $1 AND user_id = $2`, [skillId, userId]);
  }

  /** Match a user message to the best skill */
  static async match(userId: string, message: string, availableTools: string[]): Promise<SkillResult | null> {
    const skills = await this.list(userId);
    const enabled = skills.filter((s) => s.enabled);

    if (enabled.length === 0) return null;

    const messageLower = message.toLowerCase();
    let bestMatch: SkillResult | null = null;
    let bestScore = 0;

    for (const skill of enabled) {
      let score = 0;

      // Check trigger patterns
      for (const pattern of skill.trigger_patterns) {
        if (messageLower.includes(pattern.toLowerCase())) {
          score += 30;
        }
      }

      // Check name match
      if (messageLower.includes(skill.name.toLowerCase())) {
        score += 40;
      }

      // Check category relevance
      const categoryKeywords: Record<string, string[]> = {
        coding: ["code", "write", "implement", "function", "class", "module", "fix", "bug", "refactor"],
        testing: ["test", "spec", "assert", "coverage", "jest", "vitest", "mocha", "pytest"],
        devops: ["deploy", "docker", "ci", "cd", "pipeline", "nginx", "kubernetes", "aws"],
        analysis: ["analyze", "audit", "review", "check", "lint", "performance", "security"],
        design: ["design", "ui", "ux", "layout", "style", "css", "component", "responsive"],
        custom: [],
      };

      const keywords = categoryKeywords[skill.category] || [];
      for (const kw of keywords) {
        if (messageLower.includes(kw)) {
          score += 10;
        }
      }

      // Bonus for high success rate
      score += skill.success_rate * 0.1;

      // Bonus for tools being available
      const toolsAvailable = skill.tools_required.every((t) => availableTools.includes(t));
      if (toolsAvailable) score += 10;

      if (score > bestScore && score >= 20) {
        bestScore = score;
        bestMatch = {
          skill,
          confidence: Math.min(100, score),
          reason: `Matched on ${skill.trigger_patterns.length} patterns, category ${skill.category}`,
        };
      }
    }

    return bestMatch;
  }

  /** Record skill usage result */
  static async recordUsage(skillId: string, success: boolean, stepsUsed: number): Promise<void> {
    const skill = await this.get(skillId);
    if (!skill) return;

    const newCount = skill.usage_count + 1;
    const newSuccessRate = Math.round(
      ((skill.success_rate * skill.usage_count + (success ? 100 : 0)) / newCount)
    );
    const newAvgSteps = Math.round(
      ((skill.avg_steps * skill.usage_count + stepsUsed) / newCount)
    );

    await pool.query(
      `UPDATE agent_skills SET usage_count = $1, success_rate = $2, avg_steps = $3, updated_at = NOW() WHERE id = $4`,
      [newCount, newSuccessRate, newAvgSteps, skillId]
    );
  }

  /** Get skill prompt injection for agent context */
  static getSkillPrompt(skill: Skill): string {
    let prompt = `## Active Skill: ${skill.name}\n`;
    prompt += `${skill.description}\n\n`;
    prompt += `### Instructions\n${skill.system_prompt}\n\n`;

    if (skill.examples.length > 0) {
      prompt += `### Examples\n`;
      for (const ex of skill.examples) {
        prompt += `**Input:** ${ex.input}\n`;
        prompt += `**Steps:** ${ex.steps.join(" → ")}\n`;
        prompt += `**Output:** ${ex.output}\n\n`;
      }
    }

    if (skill.success_criteria) {
      prompt += `### Success Criteria\n${skill.success_criteria}\n\n`;
    }

    prompt += `Step budget: ${skill.max_steps} steps\n`;

    return prompt;
  }

  /** Seed default skills */
  static async seedDefaults(userId: string): Promise<void> {
    const defaults: Partial<Skill>[] = [
      {
        name: "bug-fix",
        description: "Systematically find and fix bugs",
        category: "coding",
        trigger_patterns: ["fix bug", "fix error", "broken", "not working", "crash", "exception", "TypeError", "ReferenceError"],
        system_prompt: `You are a bug-fixing specialist. Follow this process:
1. REPRODUCE: Run the failing code to see the exact error
2. LOCATE: Use grep/read to find the error source
3. UNDERSTAND: Read surrounding code to understand context
4. FIX: Make the minimal change needed
5. VERIFY: Run tests to confirm the fix works
6. REGRESSION: Check that nothing else broke`,
        tools_required: ["read", "grep", "bash", "edit"],
        examples: [
          { input: "TypeError: Cannot read property 'map' of undefined", steps: ["grep for the error", "read the file", "find null check missing", "add optional chaining"], output: "Added ?. before .map, tests pass" },
        ],
        success_criteria: "Error no longer occurs, all tests pass, no regressions",
        max_steps: 25,
      },
      {
        name: "test-writer",
        description: "Write comprehensive tests for code",
        category: "testing",
        trigger_patterns: ["write test", "add test", "test coverage", "unit test", "integration test", "e2e test"],
        system_prompt: `You are a test-writing specialist. Follow this process:
1. READ: Understand the code to be tested
2. IDENTIFY: Find all public functions, edge cases, error paths
3. WRITE: Create tests covering happy path, edge cases, errors
4. RUN: Execute tests and fix any failures
5. VERIFY: Ensure all tests pass and coverage is reasonable`,
        tools_required: ["read", "write", "bash", "grep"],
        examples: [
          { input: "Write tests for the UserService.create method", steps: ["read UserService.ts", "identify create method signature", "write tests for success, duplicate, validation"], output: "5 tests covering create, all passing" },
        ],
        success_criteria: "All tests pass, meaningful coverage of the target code",
        max_steps: 20,
      },
      {
        name: "refactor",
        description: "Refactor code for better quality",
        category: "coding",
        trigger_patterns: ["refactor", "clean up", "improve", "optimize", "restructure", "extract"],
        system_prompt: `You are a refactoring specialist. Follow this process:
1. ANALYZE: Read the code and identify issues (duplication, complexity, naming)
2. PLAN: Create a refactoring plan that preserves behavior
3. TEST: Ensure tests exist before changing anything
4. REFACTOR: Make changes incrementally, testing after each
5. VERIFY: Run full test suite to confirm no regressions`,
        tools_required: ["read", "edit", "bash", "grep"],
        examples: [
          { input: "Extract the validation logic into a reusable function", steps: ["read the code", "identify validation patterns", "extract to validate.ts", "update imports"], output: "Extracted validateInput(), 3 callers updated, tests pass" },
        ],
        success_criteria: "Code is cleaner, all tests still pass, no behavior change",
        max_steps: 30,
      },
      {
        name: "api-builder",
        description: "Build REST API endpoints",
        category: "coding",
        trigger_patterns: ["api", "endpoint", "route", "rest", "crud", "controller"],
        system_prompt: `You are an API builder. Follow this process:
1. DESIGN: Define the endpoint (method, path, request/response schema)
2. IMPLEMENT: Write the route handler with validation
3. TEST: Write integration tests for the endpoint
4. DOCUMENT: Add inline comments and update API docs if they exist`,
        tools_required: ["read", "write", "edit", "bash"],
        examples: [
          { input: "Create a GET /api/users/:id endpoint", steps: ["read existing routes", "create user route", "add validation", "write tests"], output: "GET /api/users/:id with validation, error handling, tests" },
        ],
        success_criteria: "Endpoint works, validates input, handles errors, has tests",
        max_steps: 25,
      },
      {
        name: "docker-setup",
        description: "Set up Docker containers and compose",
        category: "devops",
        trigger_patterns: ["docker", "container", "compose", "dockerfile", "image"],
        system_prompt: `You are a Docker specialist. Follow this process:
1. ANALYZE: Understand the application stack and dependencies
2. DOCKERFILE: Create optimized multi-stage Dockerfile
3. COMPOSE: Set up docker-compose.yml with all services
4. BUILD: Build and test the containers
5. VERIFY: Ensure the application runs correctly in containers`,
        tools_required: ["read", "write", "bash"],
        examples: [
          { input: "Dockerize this Node.js app with PostgreSQL", steps: ["read package.json", "create Dockerfile", "create docker-compose.yml", "build and test"], output: "Multi-stage Dockerfile, compose with app + postgres, all working" },
        ],
        success_criteria: "Containers build and run, application works in Docker",
        max_steps: 20,
      },
      {
        name: "performance-audit",
        description: "Analyze and optimize performance",
        category: "analysis",
        trigger_patterns: ["performance", "slow", "optimize", "speed", "latency", "bottleneck", "profile"],
        system_prompt: `You are a performance specialist. Follow this process:
1. MEASURE: Run benchmarks to establish baseline
2. PROFILE: Identify bottlenecks using available tools
3. ANALYZE: Determine root causes of slowness
4. FIX: Apply targeted optimizations
5. VERIFY: Re-measure to confirm improvements`,
        tools_required: ["read", "bash", "grep", "edit"],
        examples: [
          { input: "This API endpoint is slow, optimize it", steps: ["profile the endpoint", "find N+1 query", "add eager loading", "re-measure"], output: "Response time: 2.3s → 0.15s (15x improvement)" },
        ],
        success_criteria: "Measurable performance improvement with no regressions",
        max_steps: 25,
      },
      {
        name: "security-audit",
        description: "Check for security vulnerabilities",
        category: "analysis",
        trigger_patterns: ["security", "vulnerability", "xss", "csrf", "injection", "auth", "sanitize"],
        system_prompt: `You are a security specialist. Follow this process:
1. SCAN: Check for common vulnerability patterns
2. AUDIT: Review authentication, authorization, input validation
3. IDENTIFY: List all found vulnerabilities with severity
4. FIX: Apply fixes for each vulnerability
5. VERIFY: Re-scan to confirm fixes`,
        tools_required: ["read", "grep", "bash", "edit"],
        examples: [
          { input: "Check this app for SQL injection vulnerabilities", steps: ["grep for raw queries", "check parameterization", "find unescaped input", "fix with prepared statements"], output: "Found 3 SQL injection risks, all fixed with parameterized queries" },
        ],
        success_criteria: "All identified vulnerabilities fixed, no new issues introduced",
        max_steps: 30,
      },
      {
        name: "documentation",
        description: "Write and update documentation",
        category: "custom",
        trigger_patterns: ["document", "docs", "readme", "jsdoc", "comment", "explain"],
        system_prompt: `You are a documentation specialist. Follow this process:
1. READ: Understand the code/functionality to document
2. STRUCTURE: Create clear documentation structure
3. WRITE: Write clear, concise documentation with examples
4. REVIEW: Ensure accuracy and completeness`,
        tools_required: ["read", "write", "grep"],
        examples: [
          { input: "Write a README for this project", steps: ["read package.json", "read main entry points", "write README with install/usage/api"], output: "Complete README with badges, install, usage, API docs" },
        ],
        success_criteria: "Documentation is accurate, complete, and well-structured",
        max_steps: 15,
      },
    ];

    for (const skill of defaults) {
      await this.create(userId, skill);
    }
  }

  private static parseRow(row: any): Skill {
    return {
      ...row,
      trigger_patterns: typeof row.trigger_patterns === "string" ? JSON.parse(row.trigger_patterns) : row.trigger_patterns,
      tools_required: typeof row.tools_required === "string" ? JSON.parse(row.tools_required) : row.tools_required,
      examples: typeof row.examples === "string" ? JSON.parse(row.examples) : row.examples,
    };
  }
}
