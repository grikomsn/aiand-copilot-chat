import * as vscode from "vscode";
import { AiandAuth } from "./auth/auth";
import { messageOf } from "./errors";
import {
  advertisedModelLimits,
  FALLBACK_MODEL_METADATA,
  FALLBACK_MODELS,
  formatTokenLimit,
  formatModelName,
  enrichModelMetadata,
  orderModelMetadata,
  type AiandApiModel,
  type AiandModelMetadata,
} from "./models/catalog";
import {
  DEFAULT_REASONING_EFFORT,
  applyReasoningEffort,
  buildModelConfigurationSchema,
  contextSizeOptions,
  resolveContextCap,
  resolveContextSize,
  resolveReasoningEffort,
  type ReasoningEffort,
} from "./models/options";
import { modelPricingFields } from "./models/pricing";
import { parseCatalogSnapshots } from "./models/cache";
import { ModelsDevMetadata } from "./models/metadata";
import { ChatCompletionStreamParser, validateStreamCompletion } from "./transport/sse";
import { AIAND_ENDPOINTS, aiandHeaders } from "./transport/protocol";
import { apiError } from "./transport/errors";
import { recordRequestUsage, type AiandUsageSnapshot } from "./usage/domain";
import { apiKeyFromConfiguration, credentialRefForApiKey, qualifiedModelId } from "./provider-profile";
import { isTransientNetworkError, isTransientServerError, retryDelayMs } from "./provider/retry";
import { messageToText } from "./provider/messages";
import { buildRequest } from "./provider/request";
import { trimHistoryToFit } from "./provider/history-trim";
import { reportEvent } from "./provider/response";

export { API_BASE } from "./transport/protocol";

export interface AiandModel extends vscode.LanguageModelChatInformation {
  rawModelId: string;
  credentialRef: string;
  reasoningEffort: boolean;
}

export class AiandProvider implements vscode.LanguageModelChatProvider<AiandModel> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly usageEmitter = new vscode.EventEmitter<{
    credentialRef: string;
    usage: AiandUsageSnapshot;
  }>();
  readonly onDidChangeLanguageModelChatInformation = this.changeEmitter.event;
  readonly onDidChangeUsage = this.usageEmitter.event;
  private readonly catalogs = new Map<string, AiandModelMetadata[]>();
  private readonly refreshedAt = new Map<string, number>();
  private readonly apiKeys = new Map<string, string>();
  private readonly usage = new Map<string, AiandUsageSnapshot>();
  private activeCredentialRef = "legacy";
  private readonly metadata: ModelsDevMetadata;

  private get configuration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("aiandCopilot");
  }

  private get debugLogging(): boolean {
    return this.configuration.get("debugLogging", false);
  }

  constructor(
    private readonly auth: AiandAuth,
    private readonly output: vscode.OutputChannel,
    private readonly userAgent: string,
    private readonly state?: vscode.Memento,
  ) {
    this.metadata = new ModelsDevMetadata(state ?? new MemoryMetadataCache());
    for (const [key, catalog] of Object.entries(parseCatalogSnapshots(state?.get<unknown>(CATALOG_STATE_KEY))))
      this.catalogs.set(key, catalog);
    for (const [key, usage] of Object.entries(state?.get<Record<string, AiandUsageSnapshot>>(USAGE_STATE_KEY) ?? {})) {
      if (usage && typeof usage === "object") this.usage.set(key, usage);
    }
  }

  fireDidChange(): void {
    this.changeEmitter.fire();
  }

  async configureApiKey(apiKey: string): Promise<string[]> {
    const models = await this.fetchModels(apiKey.trim());
    await this.auth.storeApiKey(apiKey);
    this.apiKeys.set("legacy", apiKey.trim());
    this.setCatalog("legacy", models);
    void this.refreshUsage("legacy").catch((error) => {
      this.output.appendLine(`[usage] initial account refresh failed: ${messageOf(error)}`);
    });
    this.changeEmitter.fire();
    return models.map(({ id }) => id);
  }

  async clearApiKey(): Promise<void> {
    await this.auth.clearApiKey();
    this.apiKeys.delete("legacy");
    this.setCatalog("legacy", [...FALLBACK_MODEL_METADATA]);
    this.refreshedAt.delete("legacy");
    this.setUsage("legacy", {});
    this.changeEmitter.fire();
  }

  async refreshModels(): Promise<string[]> {
    const apiKey = await this.requireApiKey(false, "legacy");
    const models = await this.refreshCatalog("legacy", apiKey);
    this.changeEmitter.fire();
    return models.map(({ id }) => id);
  }

  async provideLanguageModelChatInformation(
    options: vscode.PrepareLanguageModelChatModelOptions,
    token: vscode.CancellationToken,
  ): Promise<AiandModel[]> {
    const legacyApiKey = await this.auth.getApiKey();
    const configuredApiKey = options.configuration ? apiKeyFromConfiguration(options.configuration) : undefined;
    if (token.isCancellationRequested || (options.configuration && !configuredApiKey)) return [];
    const apiKey = configuredApiKey ?? legacyApiKey;
    const credentialRef = configuredApiKey ? credentialRefForApiKey(configuredApiKey, legacyApiKey) : "legacy";
    this.activeCredentialRef = credentialRef;
    if (apiKey) this.apiKeys.set(credentialRef, apiKey);
    const maxAge = Math.max(1, this.configuration.get("catalogCacheMinutes", 5)) * 60_000;
    if (apiKey && Date.now() - (this.refreshedAt.get(credentialRef) ?? 0) > maxAge) {
      try {
        await this.refreshCatalog(credentialRef, apiKey, token);
      } catch (error) {
        if (!token.isCancellationRequested) {
          this.output.appendLine(`[models] discovery failed; using cached/fallback list: ${messageOf(error)}`);
        }
      }
    }

    const defaultEffort = resolveReasoningEffort(
      undefined,
      this.configuration.get("reasoningEffort", DEFAULT_REASONING_EFFORT),
    );
    return this.catalogFor(credentialRef).map((metadata) => {
      const pricing = modelPricingFields(metadata.cost);
      const limits = advertisedModelLimits(metadata, this.configuration.get("maxOutputTokens", 0));
      return {
        id: qualifiedModelId(credentialRef, metadata.id),
        rawModelId: metadata.id,
        credentialRef,
        reasoningEffort: metadata.reasoningEffort,
        name: metadata.name || formatModelName(metadata.id),
        family: modelFamily(metadata.id),
        version: metadata.version,
        detail:
          credentialRef === "legacy"
            ? apiKey
              ? "ai&"
              : "ai& API key required"
            : `ai& · ${credentialRef.slice(0, 8)}`,
        tooltip: `${metadata.id} via ai& · ${formatTokenLimit(metadata.contextLength)} context · ${formatTokenLimit(
          metadata.maxOutputTokens,
        )} max output${metadata.imageInput ? " · image input" : " · text input"}${
          metadata.releaseDate ? ` · released ${metadata.releaseDate}` : ""
        }${pricing ? ` · ${pricing.pricing}` : ""}${metadata.description ? `\n${metadata.description}` : ""}`,
        ...limits,
        isUserSelectable: true,
        ...(credentialRef !== "legacy" ? { isBYOK: true } : {}),
        ...(credentialRef === "legacy" && !apiKey
          ? { requiresAuthorization: { label: "Configure ai& API key" } }
          : {}),
        ...(metadata.reasoningEffort || contextSizeOptions(limits.maxInputTokens)
          ? {
              configurationSchema: buildModelConfigurationSchema(
                metadata.reasoningEffort ? defaultEffort : undefined,
                contextSizeOptions(limits.maxInputTokens),
              ),
            }
          : {}),
        capabilities: {
          imageInput: metadata.imageInput,
          toolCalling: metadata.toolCalling,
        },
        ...(pricing ?? {}),
      };
    });
  }

  async provideLanguageModelChatResponse(
    model: AiandModel,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart2>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    const apiKey = await this.requireApiKey(false, model.credentialRef);
    const reasoningEffort = resolveReasoningEffort(
      options.modelConfiguration,
      this.configuration.get("reasoningEffort", DEFAULT_REASONING_EFFORT),
    );
    const requestBody = buildRequest(
      model.rawModelId,
      messages,
      options,
      reasoningEffort,
      model.maxOutputTokens,
      this.configuration.get("maxOutputTokens", 0),
      Boolean(model.capabilities?.imageInput),
      model.reasoningEffort,
      resolveContextCap(resolveContextSize(options.modelConfiguration), model.maxInputTokens),
    );
    const controller = new AbortController();
    const cancellation = token.onCancellationRequested(() => controller.abort());
    const timeoutSeconds = Math.max(10, this.configuration.get("requestTimeoutSeconds", 600));
    const idleTimeoutSeconds = Math.max(10, this.configuration.get("streamIdleTimeoutSeconds", 120));
    let timedOut: "total" | "idle" | undefined;
    const totalTimeout = setTimeout(() => {
      timedOut = "total";
      controller.abort();
    }, timeoutSeconds * 1000);
    let idleTimeout: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimeout = (): void => {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        timedOut = "idle";
        controller.abort();
      }, idleTimeoutSeconds * 1000);
    };
    resetIdleTimeout();
    try {
      if (this.debugLogging) {
        this.output.appendLine(
          `[request] model=${model.rawModelId} effort=${reasoningEffort} initiator=${
            options.requestInitiator ?? "unknown"
          }`,
        );
      }
      const response = await this.fetchInference({
        method: "POST",
        headers: this.requestHeaders(apiKey, "text/event-stream"),
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      if (!response.ok) throw await apiError(`ai& request failed for ${model.rawModelId}`, response);
      if (!response.body) throw new Error("ai& returned an empty response stream");

      const parser = new ChatCompletionStreamParser();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        if (token.isCancellationRequested) {
          await reader.cancel();
          return;
        }
        const result = await reader.read();
        if (result.done) break;
        resetIdleTimeout();
        for (const event of parser.push(decoder.decode(result.value, { stream: true }))) {
          reportEvent(event, progress, (usage) => this.recordUsage(model.credentialRef, model.rawModelId, usage));
        }
      }
      for (const event of parser.finish())
        reportEvent(event, progress, (usage) => this.recordUsage(model.credentialRef, model.rawModelId, usage));
      validateStreamCompletion(parser.finishReason);
    } catch (error) {
      if (token.isCancellationRequested) return;
      if (timedOut === "idle")
        throw new Error(`ai& request for ${model.rawModelId} received no data for ${idleTimeoutSeconds} seconds`);
      if (timedOut === "total")
        throw new Error(`ai& request for ${model.rawModelId} exceeded ${timeoutSeconds} seconds`);
      throw error;
    } finally {
      clearTimeout(totalTimeout);
      if (idleTimeout) clearTimeout(idleTimeout);
      cancellation.dispose();
    }
  }

  async provideTokenCount(
    _model: AiandModel,
    value: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken,
  ): Promise<number> {
    const text = typeof value === "string" ? value : messageToText(value);
    return Math.max(1, Math.ceil(text.length / 4));
  }

  async testConnection(): Promise<{
    model: string;
    reasoningEffort?: ReasoningEffort;
    text: string;
  }> {
    const credentialRef = "legacy";
    const apiKey = await this.requireApiKey(false, credentialRef);
    const models = this.catalogFor(credentialRef);
    const model = models[0]?.id ?? FALLBACK_MODELS[0];
    const reasoningEffort = resolveReasoningEffort(
      undefined,
      this.configuration.get("reasoningEffort", DEFAULT_REASONING_EFFORT),
    );
    const requestBody = {
      model,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: ai& connection verified",
        },
      ],
      max_completion_tokens: 512,
      stream: false,
    };
    const response = await fetch(AIAND_ENDPOINTS.chat, {
      method: "POST",
      headers: this.requestHeaders(apiKey, "application/json"),
      body: JSON.stringify(
        models[0]?.reasoningEffort ? applyReasoningEffort(requestBody, reasoningEffort) : requestBody,
      ),
    });
    if (!response.ok) throw await apiError("ai& connection test failed", response);
    const responseBody = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      model,
      ...(models[0]?.reasoningEffort ? { reasoningEffort } : {}),
      text: responseBody.choices?.[0]?.message?.content?.trim() ?? "(empty response)",
    };
  }

  getActiveCredentialRef(): string {
    return this.activeCredentialRef;
  }
  getUsageSnapshot(credentialRef = this.activeCredentialRef): AiandUsageSnapshot {
    return this.usage.get(credentialRef) ?? {};
  }
  getUsageSnapshots(): Record<string, AiandUsageSnapshot> {
    return Object.fromEntries(this.usage);
  }

  async refreshUsage(credentialRef = this.activeCredentialRef): Promise<AiandUsageSnapshot> {
    // ai& exposes no account-balance endpoint; per-request token usage
    // arrives in stream `usage` blocks and is tracked locally via
    // recordRequestUsage. Refreshing therefore just stamps the cached
    // snapshot so the UI can re-render.
    await this.requireApiKey(false, credentialRef);
    const next = { ...this.getUsageSnapshot(credentialRef), updatedAt: Date.now(), error: undefined };
    this.setUsage(credentialRef, next);
    return next;
  }

  private async fetchModels(apiKey: string): Promise<AiandModelMetadata[]> {
    if (!apiKey) throw new Error("ai& API key is not configured");
    const response = await fetch(AIAND_ENDPOINTS.models, {
      headers: this.requestHeaders(apiKey, "application/json, application/problem+json"),
    });
    if (!response.ok) throw await apiError("Unable to list ai& models", response);
    const body = (await response.json()) as { data?: AiandApiModel[] };
    const enrichment = await this.metadata.getOrRefresh();
    const models = orderModelMetadata(body.data ?? []).map((model) =>
      enrichModelMetadata(model, enrichment.models[model.id]),
    );
    if (!models.length) throw new Error("ai& returned no chat-capable models");
    if (this.debugLogging) this.output.appendLine(`[models] ${models.map(({ id }) => id).join(", ")}`);
    return models;
  }

  private async requireApiKey(prompt: boolean, credentialRef: string): Promise<string> {
    let apiKey = credentialRef === "legacy" ? await this.auth.getApiKey() : this.apiKeys.get(credentialRef);
    if (!apiKey && prompt && credentialRef === "legacy") {
      await vscode.commands.executeCommand("aiandCopilot.configureApiKey");
      apiKey = await this.auth.getApiKey();
    }
    if (!apiKey) {
      throw new Error(
        credentialRef === "legacy"
          ? "ai& API key is not configured. Run ‘ai&: Configure API Key’."
          : "The API key for this ai& provider entry is unavailable. Update the entry in Manage Language Models.",
      );
    }
    return apiKey;
  }

  private catalogFor(credentialRef: string): AiandModelMetadata[] {
    let catalog = this.catalogs.get(credentialRef);
    if (!catalog) {
      catalog = [...FALLBACK_MODEL_METADATA];
      this.catalogs.set(credentialRef, catalog);
    }
    return catalog;
  }

  private setCatalog(credentialRef: string, models: readonly AiandModelMetadata[]): void {
    this.catalogs.set(credentialRef, [...models]);
    this.refreshedAt.set(credentialRef, Date.now());
    void this.state?.update(CATALOG_STATE_KEY, Object.fromEntries(this.catalogs));
  }

  private async refreshCatalog(
    credentialRef: string,
    apiKey: string,
    token?: vscode.CancellationToken,
  ): Promise<AiandModelMetadata[]> {
    if (token?.isCancellationRequested) return this.catalogFor(credentialRef);
    const models = await this.fetchModels(apiKey);
    this.setCatalog(credentialRef, models);
    return models;
  }

  private requestHeaders(apiKey: string, accept: string): Record<string, string> {
    return aiandHeaders(apiKey, accept, this.userAgent);
  }

  private async fetchInference(init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetch(AIAND_ENDPOINTS.chat, init);
        if (attempt >= 2 || !isTransientServerError(response.status)) return response;
        const delay = retryDelayMs(attempt, response.headers.get("retry-after"));
        this.output.appendLine(`[retry] transient HTTP ${response.status}; attempt=${attempt + 2} delayMs=${delay}`);
        await response.body?.cancel().catch(() => undefined);
        await waitForRetry(delay, init.signal);
      } catch (error) {
        if (attempt >= 2 || !isTransientNetworkError(error)) throw error;
        const delay = retryDelayMs(attempt);
        this.output.appendLine(`[retry] transient network failure; attempt=${attempt + 2} delayMs=${delay}`);
        await waitForRetry(delay, init.signal);
      }
    }
  }

  private recordUsage(credentialRef: string, modelId: string, raw: Record<string, unknown>): void {
    this.setUsage(credentialRef, recordRequestUsage(this.getUsageSnapshot(credentialRef), raw, modelId));
    if (this.debugLogging) this.output.appendLine(`[usage] model=${modelId} recorded`);
  }

  private setUsage(credentialRef: string, usage: AiandUsageSnapshot): void {
    this.usage.set(credentialRef, usage);
    this.usageEmitter.fire({ credentialRef, usage });
    void this.state?.update(USAGE_STATE_KEY, Object.fromEntries(this.usage));
  }
}

const CATALOG_STATE_KEY = "aiandCopilot.catalogs.v1";
const USAGE_STATE_KEY = "aiandCopilot.usageSnapshots.v1";

class MemoryMetadataCache {
  get<T>(_key: string): T | undefined {
    return undefined;
  }
  async update(_key: string, _value: unknown): Promise<void> {}
}

function modelFamily(modelId: string): string {
  return modelId.toLowerCase().split(/[-/]/, 1)[0] || "aiand";
}

async function waitForRetry(milliseconds: number, signal: AbortSignal | null | undefined): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
