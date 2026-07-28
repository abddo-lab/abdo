/**
 * Deploy Service — FreeDNS domain connection + deploy previews
 * Supports z0.bot.nu (afraid.org) and z0.fly.io (Fly.io)
 */

import { getConfig } from "./config";
import { settingsDB } from "./db";

export interface DomainRecord {
  id: string;
  subdomain: string;
  domain: string;
  fullDomain: string;
  targetUrl: string;
  type: "afraid" | "fly";
  status: "active" | "pending" | "expired" | "error";
  createdAt: number;
  expiresAt?: number;
  repo?: string;
  branch?: string;
  ssl: boolean;
}

export interface DeployPreview {
  id: string;
  domain: string;
  url: string;
  repo: string;
  branch: string;
  commit: string;
  status: "building" | "live" | "failed" | "expired";
  createdAt: number;
  expiresAt: number;
  buildLog: string[];
}

// ─── FreeDNS (afraid.org) API ───
async function freednsUpdate(subdomain: string, domain: string, ip: string, token: string): Promise<{ success: boolean; message: string }> {
  try {
    const url = `https://sync.afraid.org/u/${token}/?action=add&domain=${subdomain}.${domain}&ip=${ip}`;
    await fetch(url, { mode: "no-cors" });
    // afraid.org returns 200 with no-cors
    return { success: true, message: `Subdomain ${subdomain}.${domain} updated to ${ip}` };
  } catch (err) {
    return { success: false, message: `FreeDNS update failed: ${err}` };
  }
}



// ─── Domain Management ───
export async function getDomains(): Promise<DomainRecord[]> {
  return settingsDB.get<DomainRecord[]>("deploy_domains", []);
}

export async function createSubdomain(subdomain: string, domainIndex = 0): Promise<DomainRecord> {
  const config = getConfig();
  const domain = config.freedns.domains[domainIndex] ?? config.freedns.domains[0];

  // Validate subdomain
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
    throw new Error("Invalid subdomain: must be lowercase alphanumeric with hyphens");
  }
  if (subdomain.length < 3 || subdomain.length > 63) {
    throw new Error("Subdomain must be 3-63 characters");
  }

  const fullDomain = `${subdomain}.${domain.domain}`;
  const record: DomainRecord = {
    id: `dom-${Date.now()}`,
    subdomain,
    domain: domain.domain,
    fullDomain,
    targetUrl: "",
    type: domain.type,
    status: "pending",
    createdAt: Date.now(),
    ssl: domain.type === "fly",
  };

  const domains = await getDomains();
  domains.push(record);
  await settingsDB.set("deploy_domains", domains);

  return record;
}

export async function connectDomain(id: string, targetUrl: string): Promise<DomainRecord> {
  const domains = await getDomains();
  const record = domains.find((d) => d.id === id);
  if (!record) throw new Error("Domain not found");

  record.targetUrl = targetUrl;
  record.status = "active";

  // Update DNS if using FreeDNS
  if (record.type === "afraid") {
    const config = getConfig();
    if (config.freedns.token) {
      // Resolve target IP (simplified — in production use DNS lookup)
      const ip = "127.0.0.1"; // placeholder
      await freednsUpdate(record.subdomain, record.domain, ip, config.freedns.token);
    }
  }

  await settingsDB.set("deploy_domains", domains);
  return record;
}

export async function deleteDomain(id: string): Promise<void> {
  const domains = await getDomains();
  await settingsDB.set("deploy_domains", domains.filter((d) => d.id !== id));
}

// ─── Deploy Previews ───
export async function getPreviews(): Promise<DeployPreview[]> {
  return settingsDB.get<DeployPreview[]>("deploy_previews", []);
}

export async function createPreview(repo: string, branch: string, commit: string, subdomain?: string): Promise<DeployPreview> {
  const config = getConfig();
  const domain = subdomain ?? `${repo.split("/")[1]}-${branch}`.replace(/[^a-z0-9-]/g, "").slice(0, 30);
  const fullDomain = `${domain}.${config.freedns.defaultDomain}`;

  const preview: DeployPreview = {
    id: `preview-${Date.now()}`,
    domain: fullDomain,
    url: `https://${fullDomain}`,
    repo,
    branch,
    commit,
    status: "building",
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    buildLog: ["[build] Starting..."],
  };

  const previews = await getPreviews();
  previews.push(preview);
  await settingsDB.set("deploy_previews", previews);

  // Simulate build
  setTimeout(async () => {
    const all = await getPreviews();
    const p = all.find((x) => x.id === preview.id);
    if (p) {
      p.status = "live";
      p.buildLog.push("[build] ✓ Deployed successfully");
      await settingsDB.set("deploy_previews", all);
    }
  }, 3000);

  return preview;
}

// ─── Domain Validation ───
export function validateSubdomain(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: "Subdomain is required" };
  if (name.length < 3) return { valid: false, error: "Must be at least 3 characters" };
  if (name.length > 63) return { valid: false, error: "Must be 63 characters or less" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  if (name.startsWith("-") || name.endsWith("-")) return { valid: false, error: "Cannot start or end with hyphen" };
  return { valid: true };
}

export function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain) return { valid: false, error: "Domain is required" };
  if (!domain.includes(".")) return { valid: false, error: "Must include a TLD (e.g., .com)" };
  if (domain.length > 253) return { valid: false, error: "Domain too long" };
  return { valid: true };
}

// ─── Get available subdomains ───
export function getAvailableDomains(): Array<{ domain: string; type: string; description: string }> {
  const config = getConfig();
  return config.freedns.domains.map((d) => ({
    domain: d.domain,
    type: d.type,
    description: d.description,
  }));
}
