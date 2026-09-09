import assert from "node:assert/strict";
import test from "node:test";
import { API_KEY_SECRET, credentialReference, AiandAuth, type SecretStore } from "./auth";

class MemorySecrets implements SecretStore {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

test("stores trimmed API keys and clears them", async () => {
  const secrets = new MemorySecrets();
  const auth = new AiandAuth(secrets);

  assert.equal(await auth.hasApiKey(), false);
  await auth.storeApiKey("  Aiand-secret  ");
  assert.equal(secrets.values.get(API_KEY_SECRET), "Aiand-secret");
  assert.equal(await auth.getApiKey(), "Aiand-secret");
  assert.equal(await auth.hasApiKey(), true);

  await auth.clearApiKey();
  assert.equal(await auth.getApiKey(), undefined);
});

test("rejects empty API keys", async () => {
  const auth = new AiandAuth(new MemorySecrets());
  await assert.rejects(() => auth.storeApiKey(" \n "), /cannot be empty/);
});

test("creates a stable non-reversible credential reference", () => {
  assert.equal(credentialReference(" Aiand-secret "), credentialReference("Aiand-secret"));
  assert.match(credentialReference("Aiand-secret"), /^[a-f0-9]{16}$/);
  assert.notEqual(credentialReference("Aiand-secret"), credentialReference("another-secret"));
});
