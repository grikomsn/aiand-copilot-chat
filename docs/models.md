# Models and pricing

## Live metadata

The extension discovers the catalog available to the configured Aiand account
from `https://api.aiand.com/v1/models`. Live responses provide the context window,
maximum output length, reasoning-effort support, and per-model pricing used by
Copilot Chat. A bundled snapshot keeps model selection useful during transient
catalog failures or when no key is configured.

Live `/v1/models` metadata remains authoritative. Fields those responses omit
are enriched from the canonical `aiand` provider in a six-hour models.dev
snapshot stored in VS Code `globalState`. Stale metadata is returned immediately
while refresh runs and remains available during models.dev outages.

The fallback snapshot was last updated on 2026-09-09:

| Model | Context | Max output | Images | Tools | Reasoning |
| --- | ---: | ---: | :---: | :---: | :---: |
| GPT OSS 120B (`openai/gpt-oss-120b`) | 128K | 128K | No | Yes | Yes |
| DeepSeek V4 Flash (`deepseek-ai/deepseek-v4-flash`) | 1M | 128K | No | Yes | Yes |
| DeepSeek V4 Pro (`deepseek-ai/deepseek-v4-pro`) | 1M | 128K | No | Yes | Yes |
| Kimi K3 (`moonshotai/kimi-k3`) | 1M | 256K | No | Yes | Yes |
| Kimi K2.7 Code (`moonshotai/kimi-k2.7-code`) | 256K | 256K | No | Yes | Yes |
| GLM 5.3 (`zai-org/glm-5.3`) | 1M | 128K | No | Yes | Yes |
| GLM 5.2 (`zai-org/glm-5.2`) | 1M | 128K | No | Yes | Yes |
| Gemma 4 31B IT (`google/gemma-4-31b-it`) | 256K | 256K | Yes | Yes | Yes |
| Qwen 3.8 27B (`qwen/qwen3.8-27b`) | 256K | 256K | Yes | Yes | Yes |
| Qwen 3.6 27B (`qwen/qwen3.6-27b`) | 256K | 256K | Yes | Yes | Yes |
| Motif 3 (`motif-technologies/motif-3`) | 256K | 128K | No | Yes | Yes |

Live catalog results remain authoritative when they differ from this snapshot.
Model IDs are namespaced as `provider/model` and resolution is
case-insensitive; the `X-Model` response header reports the resolved canonical
ID used for billing.

## Pricing

The model picker displays each model's live input, cached-input, and output
pricing from the Aiand `/v1/models` response when available. When live pricing
is missing, the extension falls back to the official rates captured alongside
the fallback snapshot. See [Aiand pricing](https://docs.aiand.com).

## Context window size

Each model entry exposes a Context Window control in the Copilot Chat model
picker (`src/models/options.ts`). The options are Auto (the default), fixed
64K, 128K, and 200K tiers that fit below the model's registered input limit,
and Maximum. Auto and Maximum keep the default behavior.

A specific tier acts as a local upper limit: the selection is stored per model
by VS Code, never exceeds the model's registered input limit, and when the
converted messages exceed the selected tier the oldest conversation turns are
trimmed before the request is built (`src/provider/history-trim.ts`). The
first message, the current turn, and tool-call/result adjacency are always
preserved, and models without a fitting tier keep their picker unchanged.

### Context indicator compatibility

Auto uses the model's registered input budget. The context indicator shows that
input budget plus the response reserve; a numeric context tier replaces only
the input budget. Auto is stored as `"auto"`, because VS Code interprets numeric
zero as a zero-token input window. If an existing chat still shows only the
output limit after upgrading, select Auto again in its Context Window control
to replace a saved zero selection.

Context Window uses the dedicated tokens group so it remains visible beside
reasoning controls. VS Code renders only one enum property per group.
