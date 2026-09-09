export const API_BASE = "https://api.aiand.com/v1";

export const AIAND_ENDPOINTS = {
  models: `${API_BASE}/models`,
  chat: `${API_BASE}/chat/completions`,
} as const;

export function extensionUserAgent(version: string, vscodeVersion: string): string {
  return `aiand-copilot-chat/${version} VSCode/${vscodeVersion}`;
}

export function aiandHeaders(apiKey: string, accept: string, userAgent: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: accept,
    "User-Agent": userAgent,
  };
}
