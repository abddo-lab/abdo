/**
 * Configuration System — all API keys, secrets, and settings in one place
 * Loaded from environment or IndexedDB
 */

import { settingsDB } from "./db";

export interface AppConfig {
  // Model API
  modelApi: {
    baseUrl: string;
    serviceKey: string;
    defaultModel: string;
    availableModels: string[];
  };

  // GitHub OAuth
  github: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };

  // Daytona Sandbox
  daytona: {
    apiUrl: string;
    apiKey: string;
    defaultSandboxImage: string;
    pricingPerHour: number; // USD per hour
    autoStopMinutes: number;
  };

  // FreeDNS (afraid.org)
  freedns: {
    apiUrl: string;
    token: string;
    domains: Array<{ domain: string; type: "afraid" | "fly"; description: string }>;
    defaultDomain: string;
  };

  // E2B Sandbox (free tier)
  e2b: {
    apiUrl: string;
    apiKey: string;
  };

  // AgentMail
  agentmail: {
    apiUrl: string;
    apiKey: string;
  };

  // AgentPhone
  agentphone: {
    apiUrl: string;
    apiKey: string;
  };

  // Gemini (for vision)
  gemini: {
    apiUrl: string;
    apiKey: string;
    model: string;
  };

  // Deploy
  deploy: {
    webhookUrl: string;
    previewBase: string;
    autoDeploy: boolean;
  };

  // Usage limits
  limits: {
    dailyBudgetUsd: number;
    maxTokensPerRequest: number;
    maxConcurrentAgents: number;
    maxBackgroundTasks: number;
    sandboxMaxHours: number;
  };

  // Features
  features: {
    voiceEnabled: boolean;
    autoCorrection: boolean;
    maxCorrections: number;
    codebaseIndexing: boolean;
    workflowEngine: boolean;
    mcpConnections: boolean;
  };
}

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  modelApi: {
    baseUrl: "http://crate.ftp.sh/v1",
    serviceKey: "mr-e7eacfbc9e634bb2847e87b0",
    defaultModel: "claude-fable-5",
    availableModels: ["claude-fable-5", "claude-opus-5", "claude-opus-4-8", "claude-sonnet-5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt 5.4 mini", "deepseek-v4-pro", "kimi k2.7 code", "kimi-k3", "glm-5.2", "mimo-v2.5-pro", "longcat-2.0", "gemini-3.6-flash", "gemini-3.5-flash", "minimax-m3"],
  },

  github: {
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:5173/auth/callback",
    scopes: ["repo", "read:user", "workflow"],
  },

  daytona: {
    apiUrl: "https://app.daytona.io/api",
    apiKey: "",
    defaultSandboxImage: "daytonaio/workspace:latest",
    pricingPerHour: 0.5, // $0.50/hour
    autoStopMinutes: 60,
  },

  freedns: {
    apiUrl: "https://freedns.afraid.org/api",
    token: "",
    domains: [
      { domain: "z0.bot.nu", type: "afraid", description: "FreeDNS subdomain — short-lived, free" },
      { domain: "z0.fly.io", type: "fly", description: "Fly.io subdomain — persistent, paid" },
    ],
    defaultDomain: "z0.bot.nu",
  },

  e2b: {
    apiUrl: "https://api.e2b.dev",
    apiKey: "",
  },

  agentmail: {
    apiUrl: "https://api.agentmail.to/v1",
    apiKey: "",
  },

  agentphone: {
    apiUrl: "https://api.agentphone.ai/v1",
    apiKey: "",
  },

  gemini: {
    apiUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-2.5-flash",
  },

  deploy: {
    webhookUrl: "",
    previewBase: "https://{subdomain}.z0.bot.nu",
    autoDeploy: false,
  },

  limits: {
    dailyBudgetUsd: 5,
    maxTokensPerRequest: 32768,
    maxConcurrentAgents: 4,
    maxBackgroundTasks: 10,
    sandboxMaxHours: 24,
  },

  features: {
    voiceEnabled: true,
    autoCorrection: true,
    maxCorrections: 3,
    codebaseIndexing: true,
    workflowEngine: true,
    mcpConnections: true,
  },
};

// Config singleton
let _config: AppConfig = { ...DEFAULT_CONFIG };

export async function loadConfig(): Promise<AppConfig> {
  try {
    // 1. Load from saved IndexedDB settings
    const saved = await settingsDB.get<Partial<AppConfig>>("app_config", {});
    _config = { ...DEFAULT_CONFIG, ...saved };

    // 2. Try to load from public/config.json file
    try {
      const resp = await fetch("/config.json");
      if (resp.ok) {
        const fileConfig = await resp.json();
        _config = { ..._config, ...fileConfig };
      }
    } catch {}

    // 3. Override with window.__CAI_CONFIG__ (for embedding)
    if (typeof window !== "undefined") {
      const env = (window as any).__CAI_CONFIG__;
      if (env) _config = { ..._config, ...env };
    }
  } catch {}
  return _config;
}

export function getConfig(): AppConfig {
  return _config;
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<void> {
  _config = { ..._config, ...updates };
  await settingsDB.set("app_config", _config);
}

export async function updateConfigSection<K extends keyof AppConfig>(section: K, updates: Partial<AppConfig[K]>): Promise<void> {
  _config[section] = { ..._config[section], ...updates };
  await settingsDB.set("app_config", _config);
}

// Validate a config value
export function validateConfig(config: Partial<AppConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.modelApi?.baseUrl && !config.modelApi.baseUrl.startsWith("http")) {
    errors.push("Model API URL must start with http:// or https://");
  }
  if (config.daytona?.pricingPerHour && config.daytona.pricingPerHour < 0) {
    errors.push("Daytona pricing cannot be negative");
  }
  if (config.limits?.dailyBudgetUsd && config.limits.dailyBudgetUsd < 0) {
    errors.push("Daily budget cannot be negative");
  }
  if (config.freedns?.domains) {
    for (const d of config.freedns.domains) {
      if (!d.domain.includes(".")) errors.push(`Invalid domain: ${d.domain}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
