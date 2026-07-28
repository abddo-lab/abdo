/**
 * Skills System — reusable agent capabilities
 * Inspired by Claude Code's skills + OpenCode's tool providers
 */

import { settingsDB } from "./db";
import { chatCompletion, type ChatMessage } from "./api";

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: "code" | "review" | "deploy" | "test" | "docs" | "custom";
  systemPrompt: string;
  tools: string[];
  model: string;
  temperature: number;
  builtin: boolean;
  usageCount: number;
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "skill-review",
    name: "Adversarial Review",
    description: "Deep code review for bugs, security, performance, and edge cases",
    category: "review",
    systemPrompt: `You are an adversarial code reviewer. Analyze the code for:
1. Correctness bugs and race conditions
2. Security vulnerabilities (injection, auth, secrets)
3. Performance issues (N+1, unnecessary allocations)
4. Missing error handling
5. API contract violations
For each finding: file:line, severity, description, fix suggestion.`,
    tools: ["read_file", "grep", "glob"],
    model: "claude-fable-5",
    temperature: 0.3,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-test",
    name: "Test Generator",
    description: "Generate comprehensive tests for any code",
    category: "test",
    systemPrompt: `You are a test engineer. Generate tests covering:
- Happy path
- Edge cases
- Error cases
- Boundary conditions
Use the project's test framework. Follow naming conventions.`,
    tools: ["read_file", "write_file", "bash"],
    model: "claude-fable-5",
    temperature: 0.4,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-refactor",
    name: "Code Refactorer",
    description: "Refactor code while maintaining behavior",
    category: "code",
    systemPrompt: `You are a refactoring specialist. Improve code quality:
- Extract functions/methods
- Reduce complexity
- Improve naming
- Remove duplication
- Apply SOLID principles
Never change behavior. Always preserve tests.`,
    tools: ["read_file", "edit_file", "grep"],
    model: "claude-fable-5",
    temperature: 0.3,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-docs",
    name: "Documentation Writer",
    description: "Generate and update documentation",
    category: "docs",
    systemPrompt: `You are a technical writer. Create clear documentation:
- README files
- API references
- Inline comments
- Architecture docs
Style: concise, technical, with code examples.`,
    tools: ["read_file", "write_file", "glob"],
    model: "claude-fable-5",
    temperature: 0.5,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-deploy",
    name: "Deploy Assistant",
    description: "Help with deployment and CI/CD",
    category: "deploy",
    systemPrompt: `You are a DevOps specialist. Help with:
- Docker configuration
- CI/CD pipelines
- Deployment scripts
- Environment setup
- Monitoring and logging`,
    tools: ["read_file", "write_file", "bash"],
    model: "claude-fable-5",
    temperature: 0.4,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-explain",
    name: "Code Explainer",
    description: "Explain code in plain English",
    category: "code",
    systemPrompt: `You are a code educator. Explain code clearly:
- What it does (high level)
- How it works (step by step)
- Why it's designed this way
- Potential gotchas
Use analogies for complex concepts.`,
    tools: ["read_file"],
    model: "claude-fable-5",
    temperature: 0.5,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-security",
    name: "Security Auditor",
    description: "Comprehensive security audit",
    category: "review",
    systemPrompt: `You are a security auditor. Scan for:
- Injection vulnerabilities (SQL, XSS, command)
- Authentication/authorization gaps
- Unsafe deserialization
- Leaked secrets
- Insecure dependencies
- CSRF/SSRF risks
Rate each finding: critical/high/medium/low.`,
    tools: ["read_file", "grep", "web_search"],
    model: "claude-fable-5",
    temperature: 0.2,
    builtin: true,
    usageCount: 0,
  },
  {
    id: "skill-migrate",
    name: "Migration Helper",
    description: "Help with framework/library migrations",
    category: "code",
    systemPrompt: `You are a migration specialist. Help with:
- Framework upgrades (React, Vue, Angular)
- Language migrations (JS→TS, Python 2→3)
- Database migrations
- API version upgrades
Provide step-by-step instructions with code examples.`,
    tools: ["read_file", "edit_file", "write_file", "grep"],
    model: "claude-fable-5",
    temperature: 0.4,
    builtin: true,
    usageCount: 0,
  },
];

export async function getSkills(): Promise<Skill[]> {
  const custom = await settingsDB.get<Skill[]>("custom_skills", []);
  return [...BUILTIN_SKILLS, ...custom];
}

export async function saveCustomSkill(skill: Skill): Promise<void> {
  const custom = await settingsDB.get<Skill[]>("custom_skills", []);
  const idx = custom.findIndex((s) => s.id === skill.id);
  if (idx >= 0) custom[idx] = skill;
  else custom.push(skill);
  await settingsDB.set("custom_skills", custom);
}

export async function deleteCustomSkill(id: string): Promise<void> {
  const custom = await settingsDB.get<Skill[]>("custom_skills", []);
  await settingsDB.set("custom_skills", custom.filter((s) => s.id !== id));
}

export async function executeSkill(skillId: string, task: string, context?: string): Promise<string> {
  const skills = await getSkills();
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return `Skill not found: ${skillId}`;

  const messages: ChatMessage[] = [{ role: "system", content: skill.systemPrompt }];
  if (context) messages.push({ role: "user", content: `Context:\n${context}` });
  messages.push({ role: "user", content: task });

  try {
    const resp = await chatCompletion(skill.model, messages, skill.temperature);
    // Update usage count
    if (!skill.builtin) {
      skill.usageCount++;
      await saveCustomSkill(skill);
    }
    return resp.choices[0]?.message?.content ?? "No response";
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
