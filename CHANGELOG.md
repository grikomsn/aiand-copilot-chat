# Changelog

## 0.2.0

### Minor Changes

- 6bd5fce: Scope reasoning effort per model. The Copilot Chat Reasoning Effort picker now lists exactly the efforts each ai& model accepts (from the live `reasoning_efforts` catalog field), adds the `xhigh` and `max` levels several models support, and never sends an effort the model would reject with HTTP 400. The workspace default applies only when the model supports it, otherwise the model's own default is used; models without reasoning control omit the parameter entirely. Inline suggestions now use the suggestion model's reasoning-off effort instead of assuming `none`.

## 0.1.1

### Patch Changes

- 18abd3a: Show the live ai& organization credit balance alongside locally tracked inference usage.

## 0.1.0

### Minor Changes

- Initial bootstrap of the ai& provider: OpenAI-compatible chat completions at `https://api.aiand.com/v1` with `Bearer` API-key auth, live `/v1/models` discovery plus a bundled fallback catalog, streaming text/reasoning/tool-call projection, per-model reasoning-effort and context-window controls, and opt-in ghost-text inline suggestions.
