import assert from "node:assert/strict";
import test from "node:test";
import { API_BASE, AIAND_ENDPOINTS, extensionUserAgent, aiandHeaders } from "./protocol";

test("keeps ai& endpoints and request identity centralized", () => {
  assert.equal(AIAND_ENDPOINTS.models, `${API_BASE}/models`);
  assert.equal(AIAND_ENDPOINTS.chat, `${API_BASE}/chat/completions`);
  assert.equal(extensionUserAgent("1.2.3", "1.125.0"), "aiand-copilot-chat/1.2.3 VSCode/1.125.0");
  assert.deepEqual(aiandHeaders("secret", "application/json", "agent"), {
    Authorization: "Bearer secret",
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "agent",
  });
});
