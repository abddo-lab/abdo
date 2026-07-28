/**
 * Plans & Billing System
 * Free / Pro / Max tiers with usage tracking
 */

import { settingsDB } from "./db";

export type PlanTier = "free" | "pro" | "max";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  monthlyPrice: number;       // USD
  weeklyLimit: number;        // USD per week
  sessionLimit: number;       // USD per 5h session
  workflowInstances: number;  // max concurrent
  workflowMinutesPerDay: number;
  sandboxType: "e2b" | "daytona";
  sandboxPersistence: boolean;
  agentMail: boolean;
  agentMailUnlimited: boolean;
  agentPhoneSms: number;      // SMS messages (US only)
  priority: number;           // higher = better model routing
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    monthlyPrice: 0,
    weeklyLimit: 5,
    sessionLimit: 5,
    workflowInstances: 1,
    workflowMinutesPerDay: 60,
    sandboxType: "e2b",
    sandboxPersistence: false,
    agentMail: false,
    agentMailUnlimited: false,
    agentPhoneSms: 0,
    priority: 1,
    features: ["Basic chat", "1 workflow instance", "60min/day workflow", "E2B sandbox (ephemeral)", "$5/month credit"],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    monthlyPrice: 100,
    weeklyLimit: 100,
    sessionLimit: 15,
    workflowInstances: 2,
    workflowMinutesPerDay: -1, // unlimited
    sandboxType: "daytona",
    sandboxPersistence: true,
    agentMail: false,
    agentMailUnlimited: false,
    agentPhoneSms: 0,
    priority: 2,
    features: ["Everything in Free", "2 workflow instances", "Unlimited workflow time", "Daytona sandbox (persistent)", "$100/week credit", "Priority support"],
  },
  max: {
    tier: "max",
    name: "Max",
    monthlyPrice: 250,
    weeklyLimit: 250,
    sessionLimit: 30,
    workflowInstances: -1, // unlimited
    workflowMinutesPerDay: -1,
    sandboxType: "daytona",
    sandboxPersistence: true,
    agentMail: true,
    agentMailUnlimited: true,
    agentPhoneSms: 25,
    priority: 3,
    features: ["Everything in Pro", "Unlimited workflow instances", "Daytona sandbox (persistent)", "Unlimited AgentMail", "25 SMS (US only) via AgentPhone", "$250/week credit", "$30/5h session", "Dedicated support", "2 free workflow/automation credits"],
  },
};

// ─── User Account ───
export interface UserAccount {
  id: string;
  email: string;
  githubLogin: string;
  plan: PlanTier;
  monthlyCredit: number;        // remaining USD this month
  weeklyCredit: number;         // remaining USD this week
  sessionCredit: number;        // remaining USD this 5h session
  sessionStartedAt: number;
  weeklyResetAt: number;
  monthlyResetAt: number;
  workflowInstancesActive: number;
  workflowMinutesUsedToday: number;
  agentMailUsed: number;
  agentPhoneSmsUsed: number;
  isAdmin: boolean;
  createdAt: number;
  lastLoginAt: number;
}

// ─── Account CRUD ───
export async function getAccount(email: string): Promise<UserAccount | null> {
  const accounts = await settingsDB.get<UserAccount[]>("user_accounts", []);
  return accounts.find((a) => a.email === email) ?? null;
}

export async function getOrCreateAccount(email: string, githubLogin: string): Promise<UserAccount> {
  let account = await getAccount(email);
  if (account) {
    account.lastLoginAt = Date.now();
    await saveAccount(account);
    return account;
  }

  account = {
    id: `user-${Date.now()}`,
    email,
    githubLogin,
    plan: "free",
    monthlyCredit: 5,
    weeklyCredit: 5,
    sessionCredit: 5,
    sessionStartedAt: Date.now(),
    weeklyResetAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    monthlyResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    workflowInstancesActive: 0,
    workflowMinutesUsedToday: 0,
    agentMailUsed: 0,
    agentPhoneSmsUsed: 0,
    isAdmin: email === "hsab999gm@gmail.com",
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  const accounts = await settingsDB.get<UserAccount[]>("user_accounts", []);
  accounts.push(account);
  await settingsDB.set("user_accounts", accounts);
  return account;
}

export async function saveAccount(account: UserAccount): Promise<void> {
  const accounts = await settingsDB.get<UserAccount[]>("user_accounts", []);
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  await settingsDB.set("user_accounts", accounts);
}

// ─── Credit Management ───
export async function deductCredit(email: string, amount: number, _type: "session" | "weekly" | "monthly"): Promise<boolean> {
  const account = await getAccount(email);
  if (!account) return false;

  // Check session reset (5h)
  if (Date.now() - account.sessionStartedAt > 5 * 60 * 60 * 1000) {
    account.sessionCredit = PLANS[account.plan].sessionLimit;
    account.sessionStartedAt = Date.now();
  }

  // Check weekly reset
  if (Date.now() > account.weeklyResetAt) {
    account.weeklyCredit = PLANS[account.plan].weeklyLimit;
    account.weeklyResetAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  }

  // Check monthly reset
  if (Date.now() > account.monthlyResetAt) {
    account.monthlyCredit = PLANS[account.plan].monthlyPrice || 5;
    account.monthlyResetAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }

  if (account.sessionCredit < amount) return false;
  if (account.weeklyCredit < amount) return false;

  account.sessionCredit -= amount;
  account.weeklyCredit -= amount;
  account.monthlyCredit -= amount;

  await saveAccount(account);
  return true;
}

export async function checkCredit(email: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
  const account = await getAccount(email);
  if (!account) return { allowed: false, reason: "Account not found" };

  const plan = PLANS[account.plan];

  // Session check
  if (Date.now() - account.sessionStartedAt > 5 * 60 * 60 * 1000) {
    account.sessionCredit = plan.sessionLimit;
    account.sessionStartedAt = Date.now();
    await saveAccount(account);
  }

  if (account.sessionCredit < amount) return { allowed: false, reason: `Session limit reached ($${account.sessionCredit.toFixed(2)} remaining)` };
  if (account.weeklyCredit < amount) return { allowed: false, reason: `Weekly limit reached ($${account.weeklyCredit.toFixed(2)} remaining)` };

  return { allowed: true };
}

// ─── Plan Limits ───
export async function canCreateWorkflow(email: string): Promise<{ allowed: boolean; reason?: string }> {
  const account = await getAccount(email);
  if (!account) return { allowed: false, reason: "Account not found" };

  const plan = PLANS[account.plan];
  if (plan.workflowInstances === -1) return { allowed: true }; // unlimited
  if (account.workflowInstancesActive >= plan.workflowInstances) {
    return { allowed: false, reason: `Max ${plan.workflowInstances} workflow instance(s) for ${plan.name} plan` };
  }

  return { allowed: true };
}

export async function canUseWorkflow(email: string): Promise<{ allowed: boolean; reason?: string; minutesLeft?: number }> {
  const account = await getAccount(email);
  if (!account) return { allowed: false, reason: "Account not found" };

  const plan = PLANS[account.plan];
  if (plan.workflowMinutesPerDay === -1) return { allowed: true }; // unlimited

  if (account.workflowMinutesUsedToday >= plan.workflowMinutesPerDay) {
    return { allowed: false, reason: `Daily workflow limit reached (${plan.workflowMinutesPerDay}min/day)`, minutesLeft: 0 };
  }

  return { allowed: true, minutesLeft: plan.workflowMinutesPerDay - account.workflowMinutesUsedToday };
}

export async function canSendEmail(email: string): Promise<{ allowed: boolean; reason?: string }> {
  const account = await getAccount(email);
  if (!account) return { allowed: false, reason: "Account not found" };

  const plan = PLANS[account.plan];
  if (!plan.agentMail) return { allowed: false, reason: "AgentMail requires Max plan" };
  if (plan.agentMailUnlimited) return { allowed: true };

  return { allowed: true };
}

export async function canSendSms(email: string): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  const account = await getAccount(email);
  if (!account) return { allowed: false, reason: "Account not found" };

  const plan = PLANS[account.plan];
  if (plan.agentPhoneSms === 0) return { allowed: false, reason: "SMS requires Max plan" };

  const remaining = plan.agentPhoneSms - account.agentPhoneSmsUsed;
  if (remaining <= 0) return { allowed: false, reason: "SMS limit reached", remaining: 0 };

  return { allowed: true, remaining };
}

// ─── Admin Functions ───
export async function isAdmin(email: string): Promise<boolean> {
  const account = await getAccount(email);
  return account?.isAdmin === true;
}

export async function getAllAccounts(): Promise<UserAccount[]> {
  return settingsDB.get<UserAccount[]>("user_accounts", []);
}

export async function adminUpdateAccount(email: string, updates: Partial<UserAccount>): Promise<boolean> {
  const accounts = await settingsDB.get<UserAccount[]>("user_accounts", []);
  const idx = accounts.findIndex((a) => a.email === email);
  if (idx < 0) return false;
  accounts[idx] = { ...accounts[idx], ...updates };
  await settingsDB.set("user_accounts", accounts);
  return true;
}

export async function adminSetPlan(email: string, plan: PlanTier): Promise<boolean> {
  const planConfig = PLANS[plan];
  return adminUpdateAccount(email, {
    plan,
    weeklyCredit: planConfig.weeklyLimit,
    sessionCredit: planConfig.sessionLimit,
    monthlyCredit: planConfig.monthlyPrice || 5,
  });
}

export async function adminAddCredit(email: string, amount: number): Promise<boolean> {
  const account = await getAccount(email);
  if (!account) return false;
  account.weeklyCredit += amount;
  account.monthlyCredit += amount;
  await saveAccount(account);
  return true;
}
