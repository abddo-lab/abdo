import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = `
-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  github_id INT UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  email VARCHAR(255),
  avatar_url TEXT,
  plan_id VARCHAR(50) REFERENCES plans(id),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions table (JWT tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device codes for GitHub OAuth device flow
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

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature VARCHAR(100) NOT NULL,
  amount INT NOT NULL DEFAULT 1,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_device_code ON device_codes(device_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_status ON device_codes(status);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_recorded_at ON usage(recorded_at);
`;

async function setup() {
  console.log("Setting up database schema...");
  await pool.query(schema);

  // Seed plans
  const plans = [
    {
      id: "free",
      name: "Free",
      description: "Try Kiren with limited usage",
      price_monthly: 0,
      price_yearly: 0,
      features: ["50 requests/month", "Basic models", "Community support", "1 project"],
      limits: { requests: 50, projects: 1 },
      sort_order: 0,
    },
    {
      id: "starter",
      name: "Starter",
      description: "For individual developers getting started",
      price_monthly: 20,
      price_yearly: 192,
      features: [
        "500 requests/month",
        "Advanced models",
        "Email support",
        "5 projects",
        "Code review",
        "Basic analytics",
      ],
      limits: { requests: 500, projects: 5 },
      sort_order: 1,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For professional developers who need more",
      price_monthly: 40,
      price_yearly: 384,
      features: [
        "2000 requests/month",
        "All models including GPT-4",
        "Priority support",
        "Unlimited projects",
        "Advanced code review",
        "Full analytics",
        "Custom instructions",
        "Team collaboration",
      ],
      limits: { requests: 2000, projects: -1 },
      sort_order: 2,
    },
    {
      id: "max",
      name: "Max",
      description: "For power users who need everything",
      price_monthly: 80,
      price_yearly: 768,
      features: [
        "Unlimited requests",
        "All models + early access",
        "Dedicated support",
        "Unlimited projects",
        "Advanced code review",
        "Full analytics + exports",
        "Custom instructions",
        "Team collaboration",
        "API access",
        "Custom integrations",
      ],
      limits: { requests: -1, projects: -1 },
      sort_order: 3,
    },
  ];

  for (const plan of plans) {
    await pool.query(
      `INSERT INTO plans (id, name, description, price_monthly, price_yearly, features, limits, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         price_monthly = EXCLUDED.price_monthly,
         price_yearly = EXCLUDED.price_yearly,
         features = EXCLUDED.features,
         limits = EXCLUDED.limits,
         sort_order = EXCLUDED.sort_order`,
      [plan.id, plan.name, plan.description, plan.price_monthly, plan.price_yearly, JSON.stringify(plan.features), JSON.stringify(plan.limits), plan.sort_order]
    );
  }

  console.log("Database setup complete! Plans seeded.");
  await pool.end();
}

setup().catch(console.error);
