/**
 * Subagents System — parallel specialist agents
 * Inspired by Claude Code's subagent architecture
 */

import { chatCompletion, type ChatMessage } from "./api";

export interface SubagentDef {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
}

export interface SubagentResult {
  agentId: string;
  agentName: string;
  output: string;
  duration: number;
  tokensUsed: number;
  success: boolean;
}

// Built-in specialist agents
export const BUILTIN_AGENTS: SubagentDef[] = [
  {
    id: "reviewer",
    name: "reviewer",
    role: "Adversarial code review",
    systemPrompt: `You are an adversarial code reviewer. Hunt for:
1. Correctness bugs and race conditions
2. Security vulnerabilities (injection, auth gaps, secrets)
3. Performance issues (N+1 queries, unnecessary allocations)
4. Missing error handling and edge cases
5. API contract violations

For each finding: cite the exact file/line, explain the bug, suggest a fix.
Rank by severity: critical > high > medium > low.
Only report real issues, not style preferences.`,
    model: "claude-fable-5",
    temperature: 0.3,
    maxTokens: 4096,
    tools: ["read_file", "grep", "glob"],
  },
  {
    id: "tester",
    name: "tester",
    role: "Test authoring & repair",
    systemPrompt: `You are a test engineer. Your job:
1. Read the code under test
2. Write failing tests that reproduce the bug
3. Keep iterating until the suite is green
4. Never weaken assertions to make tests pass

Use the project's existing test framework. Follow naming conventions.
Aim for: happy path, edge cases, error cases, boundary conditions.`,
    model: "claude-fable-5",
    temperature: 0.4,
    maxTokens: 4096,
    tools: ["read_file", "write_file", "bash"],
  },
  {
    id: "explorer",
    name: "explorer",
    role: "Codebase cartography",
    systemPrompt: `You are a codebase explorer. Map unfamiliar repos fast:
1. Entry points (main, index, app)
2. Data flow (where data enters, transforms, exits)
3. Module boundaries and dependencies
4. Key abstractions and patterns

Return a compact briefing:
- Architecture summary (3-5 sentences)
- Module map (name → purpose)
- Data flow diagram (text)
- Key files list`,
    model: "claude-fable-5",
    temperature: 0.5,
    maxTokens: 2048,
    tools: ["glob", "grep", "read_file"],
  },
  {
    id: "security",
    name: "security-auditor",
    role: "Vulnerability sweep",
    systemPrompt: `You are a security auditor. Scan for:
1. Injection vulnerabilities (SQL, XSS, command injection)
2. Authentication/authorization gaps
3. Unsafe deserialization
4. Leaked secrets in code
5. Insecure dependencies
6. CSRF/SSRF risks

For each finding: severity (critical/high/medium/low), file/line, description, fix suggestion.`,
    model: "claude-fable-5",
    temperature: 0.2,
    maxTokens: 4096,
    tools: ["read_file", "grep", "web_search"],
  },
  {
    id: "perf",
    name: "perf-profiler",
    role: "Performance analysis",
    systemPrompt: `You are a performance engineer. Analyze:
1. Build time bottlenecks
2. Runtime hot paths
3. Memory allocation patterns
4. Bundle size issues
5. Database query efficiency

For each issue: measure before, suggest fix, estimate improvement.
Focus on the dominant cost first (80/20 rule).`,
    model: "claude-fable-5",
    temperature: 0.3,
    maxTokens: 4096,
    tools: ["bash", "read_file", "glob"],
  },
  {
    id: "docs",
    name: "docs-writer",
    role: "Documentation sync",
    systemPrompt: `You are a documentation writer. Keep docs aligned with code:
1. Read the source code
2. Identify public APIs and exports
3. Write clear, accurate documentation
4. Include examples for each function
5. Update README when project structure changes

Style: concise, technical, with code examples.`,
    model: "claude-fable-5",
    temperature: 0.5,
    maxTokens: 4096,
    tools: ["read_file", "write_file", "glob"],
  },
  {
    id: "planner",
    name: "planner",
    role: "Architecture planning",
    systemPrompt: `You are an architecture planner. For any task:
1. Research the codebase thoroughly
2. Identify all affected files and systems
3. Design the implementation approach
4. Create a step-by-step plan with dependencies
5. Estimate complexity for each step

Output format:
## Plan
### Step 1: [description]
- Files: [list]
- Complexity: [low/medium/high]
- Dependencies: [none/step N]

### Step 2: ...`,
    model: "claude-fable-5",
    temperature: 0.4,
    maxTokens: 8192,
    tools: ["read_file", "grep", "glob"],
  },
];

// Dispatch a subagent
export async function dispatchAgent(
  agent: SubagentDef,
  task: string,
  context?: string
): Promise<SubagentResult> {
  const start = Date.now();
  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
  ];
  if (context) messages.push({ role: "user", content: `Context:\n${context}` });
  messages.push({ role: "user", content: task });

  try {
    const resp = await chatCompletion(agent.model, messages, agent.temperature);
    return {
      agentId: agent.id,
      agentName: agent.name,
      output: resp.choices[0]?.message?.content ?? "",
      duration: Date.now() - start,
      tokensUsed: resp.usage?.total_tokens ?? 0,
      success: true,
    };
  } catch (err) {
    return {
      agentId: agent.id,
      agentName: agent.name,
      output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      duration: Date.now() - start,
      tokensUsed: 0,
      success: false,
    };
  }
}

// Dispatch multiple agents in parallel
export async function dispatchAgents(
  agentIds: string[],
  task: string,
  context?: string
): Promise<SubagentResult[]> {
  const agents = agentIds.map((id) => BUILTIN_AGENTS.find((a) => a.id === id)).filter(Boolean) as SubagentDef[];
  return Promise.all(agents.map((a) => dispatchAgent(a, task, context)));
}
