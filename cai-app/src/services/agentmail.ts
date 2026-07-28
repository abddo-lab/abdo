/**
 * AgentMail Integration — email API for AI agents
 * https://docs.agentmail.to
 */

import { getConfig } from "./config";
import { canSendEmail, getAccount } from "./plans";

const AGENTMAIL_API = "https://api.agentmail.to/v1";

export interface AgentMailInbox {
  id: string;
  email: string;
  createdAt: string;
}

export interface AgentMailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
  threadId?: string;
  labels?: string[];
  createdAt: string;
}

export interface AgentMailThread {
  id: string;
  subject: string;
  messages: AgentMailMessage[];
  lastMessageAt: string;
}

// ─── API Client ───
async function agentmailFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  const apiKey = (config as any).agentmail?.apiKey;
  if (!apiKey) throw new Error("AgentMail API key not configured");

  const r = await fetch(`${AGENTMAIL_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`AgentMail error ${r.status}: ${body}`);
  }

  return r.json();
}

// ─── Inboxes ───
export async function createInbox(name?: string): Promise<AgentMailInbox> {
  return agentmailFetch<AgentMailInbox>("/inboxes", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function listInboxes(): Promise<AgentMailInbox[]> {
  const resp = await agentmailFetch<{ inboxes: AgentMailInbox[] }>("/inboxes");
  return resp.inboxes;
}

export async function getInbox(id: string): Promise<AgentMailInbox> {
  return agentmailFetch<AgentMailInbox>(`/inboxes/${id}`);
}

// ─── Messages ───
export async function sendMessage(
  to: string | string[],
  subject: string,
  body: string,
  options?: { html?: string; from?: string; attachments?: File[] }
): Promise<AgentMailMessage> {
  return agentmailFetch<AgentMailMessage>("/messages", {
    method: "POST",
    body: JSON.stringify({
      to: Array.isArray(to) ? to : [to],
      subject,
      body,
      html: options?.html,
      from: options?.from,
    }),
  });
}

export async function listMessages(inboxId?: string, limit = 50): Promise<AgentMailMessage[]> {
  const params = new URLSearchParams();
  if (inboxId) params.set("inbox_id", inboxId);
  params.set("limit", limit.toString());
  const resp = await agentmailFetch<{ messages: AgentMailMessage[] }>(`/messages?${params}`);
  return resp.messages;
}

export async function getMessage(id: string): Promise<AgentMailMessage> {
  return agentmailFetch<AgentMailMessage>(`/messages/${id}`);
}

// ─── Threads ───
export async function getThread(threadId: string): Promise<AgentMailThread> {
  return agentmailFetch<AgentMailThread>(`/threads/${threadId}`);
}

export async function listThreads(limit = 20): Promise<AgentMailThread[]> {
  const resp = await agentmailFetch<{ threads: AgentMailThread[] }>(`/threads?limit=${limit}`);
  return resp.threads;
}

// ─── Labels ───
export async function addLabel(messageId: string, label: string): Promise<void> {
  await agentmailFetch(`/messages/${messageId}/labels`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function removeLabel(messageId: string, label: string): Promise<void> {
  await agentmailFetch(`/messages/${messageId}/labels/${label}`, { method: "DELETE" });
}

// ─── Checked Send (with plan verification) ───
export async function sendEmailWithPlanCheck(
  userEmail: string,
  to: string | string[],
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; message?: AgentMailMessage }> {
  const check = await canSendEmail(userEmail);
  if (!check.allowed) return { success: false, error: check.reason };

  try {
    const message = await sendMessage(to, subject, body);
    // Track usage
    const account = await getAccount(userEmail);
    if (account) {
      account.agentMailUsed++;
      const { saveAccount } = await import("./plans");
      await saveAccount(account);
    }
    return { success: true, message };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
