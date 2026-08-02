// server/src/config.ts — Centralized configuration
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "..", "config.json");

interface AppConfig {
  app: { name: string; version: string; port: number; frontend_url: string; base_domain: string; mobile_domain: string; sandbox_domain: string; };
  github: { client_id: string; client_secret: string; webhook_secret: string; };
  database: { url: string };
  sandbox: { image: string; cpu: number; memory_gb: number; thread_storage_gb: number; workflow_storage_gb: number; auto_stop: boolean; auto_archive: boolean; auto_delete: boolean; };
  models: { base_url: string; api_key: string; };
  cloudflare: { use_quick_tunnel: boolean; tunnel_name: string; };
  afraid_dns: { sync_url: string; domain: string; };
  n8n: { default_port: number; basic_auth_user: string; basic_auth_password: string; };
  billing: { execution_cost_per_1k: number; currency: string; };
  agentmail: { api_key: string; from_inbox: string; from_name: string; } | undefined;
  smtp: { api_key: string; api_url: string; } | undefined;
}

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;
  _config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as AppConfig;
  return _config;
}

export function updateConfig(patch: Record<string, any>): AppConfig {
  const config = loadConfig();
  deepMerge(config, patch);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  _config = config;
  return config;
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else { target[key] = source[key]; }
  }
}

export type { AppConfig };
