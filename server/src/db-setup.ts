// server/src/db-setup.ts — Full database schema for Kiren
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
-- ═══════════════════════════════════════════════════════════════
-- PLANS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  github_id INT UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  email VARCHAR(255),
  avatar_url TEXT,
  plan_id VARCHAR(50) REFERENCES plans(id) DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  balance DECIMAL(10,4) NOT NULL DEFAULT 0,
  sandbox_id VARCHAR(100),
  sandbox_status VARCHAR(20) DEFAULT 'none',
  sandbox_region VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- SESSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- DEVICE CODES (GitHub OAuth device flow)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS device_codes (
  id VARCHAR(50) PRIMARY KEY,
  user_code VARCHAR(20) NOT NULL UNIQUE,
  device_code VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  user_id VARCHAR(50) REFERENCES users(id),
  github_access_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- PROJECTS (user repos / imported projects)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  repo_full_name VARCHAR(300),
  repo_url TEXT,
  branch VARCHAR(200) DEFAULT 'main',
  category VARCHAR(100) DEFAULT 'Product',
  source VARCHAR(20) DEFAULT 'github',
  stack JSONB DEFAULT '[]',
  glyph VARCHAR(10),
  color VARCHAR(20) DEFAULT '#1A1D28',
  sandbox_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- THREADS (agent conversation threads)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS threads (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT 'New Thread',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  mode VARCHAR(20) NOT NULL DEFAULT 'agent',
  model_id VARCHAR(100) DEFAULT 'claude-sonnet-5',
  branch VARCHAR(300),
  tokens_used INT NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  sandbox_id VARCHAR(100),
  agents_md TEXT,
  agent_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- THREAD BLOCKS (messages, tool calls, diffs, etc.)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS thread_blocks (
  id VARCHAR(50) PRIMARY KEY,
  thread_id VARCHAR(50) NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- SUBAGENTS (user-defined agents)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS subagents (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'agentBadge',
  color VARCHAR(20) DEFAULT '#1A1D28',
  scope VARCHAR(20) DEFAULT 'workspace',
  tools JSONB DEFAULT '[]',
  system_prompt TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- WORKFLOW INSTANCES (n8n hosted instances)
-- ═══════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════
-- WORKFLOWS — node backend columns (added idempotently)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE workflow_instances ADD COLUMN IF NOT EXISTS node_id VARCHAR(50);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  template VARCHAR(200),
  region VARCHAR(50) DEFAULT 'eu-west-1',
  plan VARCHAR(50) DEFAULT 'Starter',
  status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  sandbox_id VARCHAR(100),
  n8n_port INT,
  tunnel_url TEXT,
  dns_record_id VARCHAR(100),
  nodes INT DEFAULT 0,
  executions_total INT DEFAULT 0,
  executions_7d JSONB DEFAULT '[]',
  offered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AUTOMATIONS (simulations / scheduled agent tasks)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS automations (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(50) REFERENCES projects(id),
  name VARCHAR(200) NOT NULL,
  goal TEXT,
  trigger_config VARCHAR(200),
  prompt TEXT,
  model_id VARCHAR(100),
  runs INT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'idle',
  sandbox_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- MCP SERVERS (connected MCP instances)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mcp_servers (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  transport VARCHAR(10) DEFAULT 'stdio',
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'connected',
  tools_count INT DEFAULT 0,
  installed_on_sandbox BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- USAGE TRACKING
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usage (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id VARCHAR(50),
  model_id VARCHAR(100),
  feature VARCHAR(100) NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  amount INT DEFAULT 1,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- DEPLOYMENTS (preview URLs)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deployments (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(50) REFERENCES projects(id),
  thread_id VARCHAR(50) REFERENCES threads(id),
  sandbox_id VARCHAR(100),
  tunnel_id VARCHAR(100),
  url TEXT,
  dns_record_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'provisioning',
  port INT DEFAULT 3000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
-- AGENT SKILLS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_skills (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'custom',
  trigger_patterns JSONB DEFAULT '[]',
  system_prompt TEXT DEFAULT '',
  tools_required JSONB DEFAULT '[]',
  examples JSONB DEFAULT '[]',
  success_criteria TEXT DEFAULT '',
  max_steps INT DEFAULT 20,
  enabled BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  success_rate INT DEFAULT 0,
  avg_steps INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AGENT HOOKS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_hooks (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL,
  matcher VARCHAR(100) DEFAULT '*',
  command TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  timeout_ms INT DEFAULT 5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AGENT TEMPLATES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_templates (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'agentBadge',
  system_prompt TEXT DEFAULT '',
  default_model VARCHAR(100) DEFAULT 'claude-sonnet-5',
  default_mode VARCHAR(20) DEFAULT 'agent',
  tools_enabled JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  hooks JSONB DEFAULT '[]',
  max_steps INT DEFAULT 30,
  temperature DECIMAL(3,2) DEFAULT 0.30,
  is_public BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_device_code ON device_codes(device_code);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_project_id ON threads(project_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_blocks_thread_id ON thread_blocks(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_blocks_sort ON thread_blocks(thread_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_subagents_user_id ON subagents(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_user_id ON workflow_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_slug ON workflow_instances(slug);
CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded_at ON usage(recorded_at);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_user_id ON agent_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_hooks_user_id ON agent_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_templates_user_id ON agent_templates(user_id);

-- ═══════════════════════════════════════════════════════════════
-- USERS — extra columns (added idempotently)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"email_agent": false, "email_review": false, "web_status": true}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_ssh_password VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_vnc_password VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_ssh_port INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_vnc_port INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_selected BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_n8n_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sandbox_n8n_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT;

-- ═══════════════════════════════════════════════════════════════
-- PROJECTS — extra columns (added idempotently)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ready';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS local_path TEXT;

-- ═══════════════════════════════════════════════════════════════
-- USERS — admin + node fields (added idempotently)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- NODES — remote compute nodes (docker/compose hosts that connect back)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nodes (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  secret VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  region VARCHAR(50) DEFAULT 'remote',
  host VARCHAR(255),
  cpu_cores INT DEFAULT 0,
  memory_gb DECIMAL(8,2) DEFAULT 0,
  disk_gb DECIMAL(10,2) DEFAULT 0,
  storage_gb DECIMAL(10,2) DEFAULT 100,
  role VARCHAR(50) NOT NULL DEFAULT 'worker',
  last_seen_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  version VARCHAR(50),
  capabilities JSONB NOT NULL DEFAULT '{}',
  stats JSONB NOT NULL DEFAULT '{}',
  history JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nodes_token ON nodes(token);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- ═══════════════════════════════════════════════════════════════
-- NODE SANDBOXES — containers provisioned on remote nodes
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS node_sandboxes (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id VARCHAR(50) NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  container_id VARCHAR(100),
  label VARCHAR(100) NOT NULL DEFAULT 'main',
  status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
  ssh_tunnel VARCHAR(255),
  vnc_tunnel VARCHAR(255),
  ssh_port INT,
  vnc_port INT,
  storage_gb DECIMAL(10,2) DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_sandboxes_node_id ON node_sandboxes(node_id);
CREATE INDEX IF NOT EXISTS idx_node_sandboxes_user_id ON node_sandboxes(user_id);

-- ═══════════════════════════════════════════════════════════════
-- USER ADDONS (SMTP, etc.)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_addons (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addon_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- SMTP CONFIGS (per-user generated SMTP)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS smtp_configs (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_user VARCHAR(255) NOT NULL,
  smtp_pass VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  api_key VARCHAR(255),
  requests_used INT DEFAULT 0,
  requests_limit INT DEFAULT 1000,
  cost_per_1k DECIMAL(10,4) NOT NULL DEFAULT 0.10,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- WORKFLOW TEMPLATES (injectable n8n workflows)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workflow_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'general',
  icon VARCHAR(50) DEFAULT 'workflow',
  n8n_workflow JSONB NOT NULL DEFAULT '{}',
  nodes_count INT DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- N8N INSTANCES (n8n running on user sandbox)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS n8n_instances (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sandbox_id VARCHAR(100) NOT NULL,
  tunnel_url TEXT,
  port INT DEFAULT 5678,
  status VARCHAR(20) DEFAULT 'stopped',
  hourly_rate DECIMAL(10,4) NOT NULL DEFAULT 0,
  total_hours DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  last_started_at TIMESTAMPTZ,
  last_stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- ADDON USAGE (per-1k billing for addons)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS addon_usage (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addon_type VARCHAR(50) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  requests INT DEFAULT 1,
  cost DECIMAL(10,4) DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- WORKFLOW-MCP CONNECTIONS (link workflows to MCP for AI access)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mcp_workflows (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_instance_id VARCHAR(50) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  n8n_instance_id VARCHAR(50) REFERENCES n8n_instances(id) ON DELETE CASCADE,
  mcp_server_id VARCHAR(50) REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  webhook_url TEXT,
  api_key VARCHAR(255),
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_smtp_configs_user_id ON smtp_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_instances_user_id ON n8n_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_addon_usage_user_id ON addon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_workflows_user_id ON mcp_workflows(user_id);
`;

async function setup() {
  console.log("Setting up database schema...");
  await pool.query(schema);

  // Seed plans — money-based usage limits (5h window + weekly in USD)
  const plans = [
    {
      id: "free", name: "Free", description: "Try Kiren with $5 of usage every month",
      price_monthly: 0, price_yearly: 0,
      features: ["$5 per month of usage", "1 project", "1 sandbox"],
      limits: { projects: 1, sandbox: true, workflows: 0, session_limit_usd: 1, weekly_limit_usd: 2, monthly_limit_usd: 5 },
      sort_order: 0,
    },
    {
      id: "starter", name: "Starter", description: "For individual developers getting started",
      price_monthly: 20, price_yearly: 192,
      features: ["$5 per 5h window", "$20 per week", "Advanced models", "Email support", "5 projects", "1 sandbox", "1 workflow"],
      limits: { projects: 5, sandbox: true, workflows: 1, session_limit_usd: 5, weekly_limit_usd: 20 },
      sort_order: 1,
    },
    {
      id: "pro", name: "Pro", description: "For professional developers who need more",
      price_monthly: 40, price_yearly: 384,
      features: ["$10 per 5h window", "$40 per week", "All models", "Priority support", "Unlimited projects", "2 sandboxes", "5 workflows", "Subagents"],
      limits: { projects: -1, sandbox: true, workflows: 5, session_limit_usd: 10, weekly_limit_usd: 40 },
      sort_order: 2,
    },
    {
      id: "max", name: "Max", description: "For power users who need everything",
      price_monthly: 80, price_yearly: 768,
      features: ["$20 per 5h window", "$80 per week", "All models + early access", "Dedicated support", "Unlimited projects", "5 sandboxes", "Unlimited workflows", "Subagents", "API access"],
      limits: { projects: -1, sandbox: true, workflows: -1, session_limit_usd: 20, weekly_limit_usd: 80 },
      sort_order: 3,
    },
  ];

  for (const plan of plans) {
    await pool.query(
      `INSERT INTO plans (id, name, description, price_monthly, price_yearly, features, limits, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, description = EXCLUDED.description,
         price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly,
         features = EXCLUDED.features, limits = EXCLUDED.limits, sort_order = EXCLUDED.sort_order`,
      [plan.id, plan.name, plan.description, plan.price_monthly, plan.price_yearly,
       JSON.stringify(plan.features), JSON.stringify(plan.limits), plan.sort_order]
    );
  }

  // Seed workflow templates
  const { WorkflowTemplateService } = await import("./services/workflow-templates.js");
  await WorkflowTemplateService.seedDefaults();
  console.log("Workflow templates seeded.");

  console.log("Database setup complete! Plans seeded.");
  await pool.end();
}

setup().catch(console.error);
