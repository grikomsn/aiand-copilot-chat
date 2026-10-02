# Changelog

## 0.2.3

### Patch Changes

- 46c8fdd: Align offline model context limits and Kimi K3 vision support with the live ai& catalog.
- f73570b: Add DeepSeek V4.1 Flash and GLM 5.3 Flash to the offline model snapshot with their live context windows, vision support, reasoning defaults, and published rates, and render future ids of a known vendor without repeating the family name.

## 0.2.2

### Patch Changes

- 802bda9: Parse ai&'s flat `cached_input_per_1m` rate so live cached-input pricing reaches the picker, and add published cached-input rates to the bundled fallback pricing table. Also correct the Kimi K2.7 Code fallback to advertise image input, matching the live catalog.

## 0.2.1

### Patch Changes

- 6813b9d: Benchmark inline-completion latency across the ai& catalog and surface measured badges in the model picker. Candidates are now ordered default-first with median TTFB/total timings from live fill-in-the-middle requests, and Kimi K2.7 Code is flagged as always-reasoning (its only accepted effort is high, so ghost text may be delayed or empty). The default model is unchanged.

## 0.2.0

### Minor Changes

- 6bd5fce: Scope reasoning effort per model. The Copilot Chat Reasoning Effort picker now lists exactly the efforts each ai& model accepts (from the live `reasoning_efforts` catalog field), adds the `xhigh` and `max` levels several models support, and never sends an effort the model would reject with HTTP 400. The workspace default applies only when the model supports it, otherwise the model's own default is used; models without reasoning control omit the parameter entirely. Inline suggestions now use the suggestion model's reasoning-off effort instead of assuming `none`.

## 0.1.1

### Patch Changes

- 18abd3a: Show the live ai& organization credit balance alongside locally tracked inference usage.

## 0.1.0

### Minor Changes

- Initial bootstrap of the ai& provider: OpenAI-compatible chat completions at `https://api.aiand.com/v1` with `Bearer` API-key auth, live `/v1/models` discovery plus a bundled fallback catalog, streaming text/reasoning/tool-call projection, per-model reasoning-effort and context-window controls, and opt-in ghost-text inline suggestions.
