// server/src/db-reset.ts — Drops all Kiren tables then re-runs db-setup
import pg from "pg";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const drop = `
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
`;

async function reset() {
  console.log("Resetting database schema...");
  await pool.query(drop);
  console.log("Schema dropped.");
  await pool.end();

  const setupPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "db-setup.ts");
  const result = spawnSync("npx", ["tsx", setupPath], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("db:setup exited with code", result.status);
    process.exit(result.status ?? 1);
  }
  console.log("Database reset complete.");
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
