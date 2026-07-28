/**
 * AgentPhone Integration — SMS API for AI agents
 * US-only SMS, 25 messages for Max plan
 */

import { getConfig } from "./config";
import { canSendSms, getAccount, saveAccount } from "./plans";

const AGENTPHONE_API = "https://api.agentphone.ai/v1";

export interface SmsMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "failed";
  createdAt: string;
}

// ─── API Client ───
async function agentphoneFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  const apiKey = (config as any).agentphone?.apiKey;
  if (!apiKey) throw new Error("AgentPhone API key not configured");

  const r = await fetch(`${AGENTPHONE_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`AgentPhone error ${r.status}: ${body}`);
  }

  return r.json();
}

// ─── SMS ───
export async function sendSms(to: string, body: string): Promise<SmsMessage> {
  // Validate US number
  const cleaned = to.replace(/\D/g, "");
  if (!cleaned.startsWith("1") || cleaned.length !== 11) {
    throw new Error("Only US phone numbers supported (must start with +1)");
  }

  return agentphoneFetch<SmsMessage>("/sms", {
    method: "POST",
    body: JSON.stringify({ to: `+${cleaned}`, body }),
  });
}

export async function getSmsStatus(id: string): Promise<SmsMessage> {
  return agentphoneFetch<SmsMessage>(`/sms/${id}`);
}

export async function listSms(limit = 50): Promise<SmsMessage[]> {
  const resp = await agentphoneFetch<{ messages: SmsMessage[] }>(`/sms?limit=${limit}`);
  return resp.messages;
}

// ─── Checked Send (with plan verification) ───
export async function sendSmsWithPlanCheck(
  userEmail: string,
  to: string,
  body: string
): Promise<{ success: boolean; error?: string; remaining?: number; message?: SmsMessage }> {
  const check = await canSendSms(userEmail);
  if (!check.allowed) return { success: false, error: check.reason, remaining: check.remaining };

  try {
    const message = await sendSms(to, body);
    // Track usage
    const account = await getAccount(userEmail);
    if (account) {
      account.agentPhoneSmsUsed++;
      await saveAccount(account);
    }
    return { success: true, remaining: (check.remaining ?? 1) - 1, message };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
