/**
 * Project Memory — CLAUDE.md equivalent
 * Per-repo project context file that persists across threads
 */

import { settingsDB } from "./db";

export interface ProjectMemory {
  repo: string;
  content: string;
  sections: {
    buildCommands: string;
    codeStyle: string;
    architecture: string;
    conventions: string;
    dependencies: string;
    custom: string;
  };
  updatedAt: number;
}

export async function getProjectMemory(repo: string): Promise<ProjectMemory | null> {
  const all = await settingsDB.get<ProjectMemory[]>("project_memories", []);
  return all.find((m) => m.repo === repo) ?? null;
}

export async function saveProjectMemory(mem: ProjectMemory): Promise<void> {
  const all = await settingsDB.get<ProjectMemory[]>("project_memories", []);
  const idx = all.findIndex((m) => m.repo === mem.repo);
  if (idx >= 0) all[idx] = mem;
  else all.push(mem);
  await settingsDB.set("project_memories", all);
}

export async function generateProjectMemory(repo: string): Promise<ProjectMemory> {
  const content = `# Project: ${repo}

## Build Commands
- npm install / npm ci
- npm run dev (development)
- npm run build (production)
- npm test (tests)
- npm run lint (linting)

## Code Style
- TypeScript with strict mode
- ESLint + Prettier for formatting
- Functional components with hooks
- Named exports preferred

## Architecture
- src/ — source code
- src/services/ — backend services
- src/claudeApp/ — UI components
- Tests colocated with source

## Conventions
- Use camelCase for variables/functions
- Use PascalCase for components/interfaces
- Use UPPER_SNAKE for constants
- Prefer const over let
- Early returns preferred

## Dependencies
- React 19 + TypeScript
- Vite for bundling
- Tailwind CSS for styling
- Monaco Editor for code editing
`;

  const mem: ProjectMemory = {
    repo,
    content,
    sections: {
      buildCommands: "npm install, npm run dev, npm run build, npm test",
      codeStyle: "TypeScript strict, ESLint, Prettier, functional components",
      architecture: "src/ source, services/ backend, claudeApp/ UI",
      conventions: "camelCase vars, PascalCase components, const preferred",
      dependencies: "React 19, Vite, Tailwind, Monaco",
      custom: "",
    },
    updatedAt: Date.now(),
  };

  await saveProjectMemory(mem);
  return mem;
}

export async function buildProjectMemoryBlock(repo: string): Promise<string> {
  const mem = await getProjectMemory(repo);
  if (!mem) return "";

  return `<project_memory repo="${repo}">
${mem.content}
</project_memory>
`;
}
