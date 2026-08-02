// server/src/services/agent-templates.ts — Predefined agent configurations
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export interface AgentTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  icon: string;
  system_prompt: string;
  default_model: string;
  default_mode: "agent" | "plan" | "ask";
  tools_enabled: string[];
  skills: string[];         // skill names to activate
  hooks: string[];          // hook IDs to apply
  max_steps: number;
  temperature: number;
  is_public: boolean;
  usage_count: number;
  created_at: string;
}

export class AgentTemplatesService {
  /** Create a template */
  static async create(userId: string, data: Partial<AgentTemplate>): Promise<AgentTemplate> {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO agent_templates (id, user_id, name, description, icon, system_prompt, default_model, default_mode, tools_enabled, skills, hooks, max_steps, temperature, is_public, usage_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0) RETURNING *`,
      [
        id, userId, data.name, data.description, data.icon || "agentBadge",
        data.system_prompt || "", data.default_model || "claude-sonnet-5",
        data.default_mode || "agent", JSON.stringify(data.tools_enabled || []),
        JSON.stringify(data.skills || []), JSON.stringify(data.hooks || []),
        data.max_steps || 30, data.temperature || 0.3, data.is_public || false,
      ]
    );
    return this.parseRow(result.rows[0]);
  }

  /** List templates (user's + public) */
  static async list(userId: string): Promise<AgentTemplate[]> {
    const result = await pool.query(
      `SELECT * FROM agent_templates WHERE user_id = $1 OR is_public = true ORDER BY usage_count DESC, created_at DESC`,
      [userId]
    );
    return result.rows.map(this.parseRow);
  }

  /** Get a template */
  static async get(templateId: string): Promise<AgentTemplate | null> {
    const result = await pool.query(`SELECT * FROM agent_templates WHERE id = $1`, [templateId]);
    return result.rows[0] ? this.parseRow(result.rows[0]) : null;
  }

  /** Update a template */
  static async update(templateId: string, userId: string, data: Partial<AgentTemplate>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.system_prompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(data.system_prompt); }
    if (data.default_model !== undefined) { fields.push(`default_model = $${idx++}`); values.push(data.default_model); }
    if (data.tools_enabled !== undefined) { fields.push(`tools_enabled = $${idx++}`); values.push(JSON.stringify(data.tools_enabled)); }
    if (data.skills !== undefined) { fields.push(`skills = $${idx++}`); values.push(JSON.stringify(data.skills)); }
    if (data.max_steps !== undefined) { fields.push(`max_steps = $${idx++}`); values.push(data.max_steps); }

    if (fields.length === 0) return;
    fields.push(`updated_at = NOW()`);
    values.push(templateId, userId);

    await pool.query(`UPDATE agent_templates SET ${fields.join(", ")} WHERE id = $${idx++} AND user_id = $${idx}`, values);
  }

  /** Delete a template */
  static async delete(templateId: string, userId: string): Promise<void> {
    await pool.query(`DELETE FROM agent_templates WHERE id = $1 AND user_id = $2`, [templateId, userId]);
  }

  /** Record usage */
  static async recordUsage(templateId: string): Promise<void> {
    await pool.query(`UPDATE agent_templates SET usage_count = usage_count + 1 WHERE id = $1`, [templateId]);
  }

  /** Seed default templates */
  static async seedDefaults(userId: string): Promise<void> {
    const defaults: Partial<AgentTemplate>[] = [
      {
        name: "Full-Stack Developer",
        description: "Build complete features end-to-end with tests",
        icon: "code",
        system_prompt: `You are a senior full-stack developer. You build features completely:
1. Understand requirements thoroughly before coding
2. Read existing code to understand patterns and conventions
3. Implement with proper error handling and types
4. Write tests for all new code
5. Run tests and fix any failures
6. Verify the feature works end-to-end`,
        default_model: "claude-sonnet-5",
        default_mode: "agent",
        tools_enabled: ["read", "write", "edit", "bash", "grep", "ls", "git"],
        skills: ["bug-fix", "test-writer", "refactor"],
        max_steps: 40,
        temperature: 0.2,
      },
      {
        name: "Code Reviewer",
        description: "Thorough code review with actionable feedback",
        icon: "eye",
        system_prompt: `You are a meticulous code reviewer. You:
1. Read all changed files completely
2. Check for bugs, security issues, performance problems
3. Verify error handling and edge cases
4. Check naming, structure, and readability
5. Suggest specific improvements with code examples
6. Run tests to verify nothing is broken`,
        default_model: "claude-sonnet-5",
        default_mode: "ask",
        tools_enabled: ["read", "grep", "ls"],
        skills: ["security-audit", "performance-audit"],
        max_steps: 20,
        temperature: 0.1,
      },
      {
        name: "DevOps Engineer",
        description: "Set up CI/CD, Docker, and deployment",
        icon: "rocket",
        system_prompt: `You are a DevOps engineer. You:
1. Analyze the project stack and requirements
2. Create Dockerfiles and docker-compose configurations
3. Set up CI/CD pipelines
4. Configure environment variables and secrets
5. Test everything works in containers
6. Document the deployment process`,
        default_model: "claude-sonnet-5",
        default_mode: "agent",
        tools_enabled: ["read", "write", "bash", "grep"],
        skills: ["docker-setup"],
        max_steps: 30,
        temperature: 0.2,
      },
      {
        name: "Data Analyst",
        description: "Analyze data, create visualizations, generate reports",
        icon: "bars",
        system_prompt: `You are a data analyst. You:
1. Understand the data source and structure
2. Write queries and scripts to analyze data
3. Create visualizations and summaries
4. Identify patterns, trends, and anomalies
5. Generate actionable insights
6. Present findings clearly`,
        default_model: "claude-sonnet-5",
        default_mode: "agent",
        tools_enabled: ["read", "write", "bash", "grep"],
        skills: [],
        max_steps: 25,
        temperature: 0.3,
      },
      {
        name: "Security Auditor",
        description: "Find and fix security vulnerabilities",
        icon: "shield",
        system_prompt: `You are a security auditor. You:
1. Scan for common vulnerability patterns (XSS, CSRF, injection, auth bypass)
2. Check dependency versions for known CVEs
3. Review authentication and authorization flows
4. Verify input validation and output encoding
5. Check for secrets in code
6. Provide specific remediation for each finding`,
        default_model: "claude-sonnet-5",
        default_mode: "agent",
        tools_enabled: ["read", "grep", "bash", "edit"],
        skills: ["security-audit"],
        max_steps: 30,
        temperature: 0.1,
      },
    ];

    for (const template of defaults) {
      await this.create(userId, template);
    }
  }

  private static parseRow(row: any): AgentTemplate {
    return {
      ...row,
      tools_enabled: typeof row.tools_enabled === "string" ? JSON.parse(row.tools_enabled) : row.tools_enabled,
      skills: typeof row.skills === "string" ? JSON.parse(row.skills) : row.skills,
      hooks: typeof row.hooks === "string" ? JSON.parse(row.hooks) : row.hooks,
    };
  }
}
