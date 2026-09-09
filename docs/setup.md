# Setup and usage

## Requirements

- Visual Studio Code 1.125 or newer
- GitHub Copilot Chat installed and signed in
- A Aiand API key

A paid Copilot plan is not required for a bring-your-own-key language model provider.

## Install and connect

1. Install **Aiand for GitHub Copilot Chat**.
2. Create a key in the [Aiand dashboard](https://console.aiand.com/settings/api-keys).
3. In Copilot Chat, open the model picker, select **Manage Models**, add a **Aiand** provider entry, and enter the key.
4. Select an available Aiand model.

Provider-entry discovery uses `https://api.aiand.com/v1/models`. Models added to or removed from your Aiand account are reflected automatically after the catalog cache expires or **Aiand: Refresh Models** runs.

## Commands

| Command | Purpose |
| --- | --- |
| **Aiand: Manage Connection** | Test, refresh, replace or remove the legacy key, show logs, or open diagnostics |
| **Aiand: Configure API Key** | Validate and securely save a legacy command-managed API key |
| **Aiand: Remove API Key** | Delete the legacy key from VS Code Secret Storage |
| **Aiand: Refresh Models** | Fetch the current model list |
| **Aiand: Show Credits and Usage** | Show locally tracked token activity |
| **Aiand: Test Inference** | Send a small live inference request |
| **Aiand: Open API Keys** | Open the Aiand dashboard |
| **Aiand: Show Diagnostics** | Show the endpoint, credential state, and registered models |

## Settings

| Setting | Default | Purpose |
| --- | ---: | --- |
| `aiandCopilot.reasoningEffort` | `high` | Default Aiand reasoning effort (`none`, `low`, `medium`, or `high`) |
| `aiandCopilot.maxOutputTokens` | `0` | Output limit; `0` reserves up to 32,768 response tokens |
| `aiandCopilot.requestTimeoutSeconds` | `600` | Total inference timeout in seconds |
| `aiandCopilot.streamIdleTimeoutSeconds` | `120` | Maximum time without streamed data |
| `aiandCopilot.catalogCacheMinutes` | `5` | How long the live model catalog is cached |
| `aiandCopilot.showUsageStatusBar` | `true` | Show locally tracked token activity for the active Aiand entry |
| `aiandCopilot.debugLogging` | `false` | Log request, stream, usage, and discovery metadata |
| `aiandCopilot.inlineSuggestions` | `false` | Experimental ghost-text inline completions while typing |
| `aiandCopilot.inlineSuggestionsModel` | `deepseek-ai/deepseek-v4-flash` | Model used for inline completions at `reasoning_effort: none` |
| `aiandCopilot.inlineSuggestionsChatInput` | `false` | Also offer suggestions inside the Copilot Chat prompt box |
| `aiandCopilot.inlineSuggestionsDebounceMs` | `300` | Debounce between typing and a completion request |
| `aiandCopilot.inlineSuggestionsTimeoutMs` | `3000` | Per-request completion timeout |
| `aiandCopilot.inlineSuggestionsMaxTokens` | `128` | Tokens generated per suggestion |
| `aiandCopilot.inlineSuggestionsPrefixLines` | `10` | Document lines sent before the cursor |
| `aiandCopilot.inlineSuggestionsSuffixChars` | `300` | Document characters sent after the cursor |

Prompts and API keys are never intentionally written to the output channel.

## Inline suggestions

Inline code suggestions are experimental and off by default. When enabled, each suggestion sends a bounded fill-in-the-middle prompt (10 lines before the cursor, 300 characters after, both configurable) with FIM delimiter tokens and `reasoning_effort: "none"` to the fixed `/chat/completions` endpoint. Inline latency has not been benchmarked against Aiand yet; candidates default to the low-latency flash tier first, larger models later. Hidden reasoning deltas are discarded engine-side, and the Copilot Chat prompt box is excluded unless `aiandCopilot.inlineSuggestionsChatInput` is enabled.

**Aiand: Set Inline Suggestions Model** (also in the Manage menu) lists compatible models ordered cheap-and-fast first. A "Use a custom model id…" entry keeps any hosted model reachable. The command only writes settings, so changes apply on the next keystroke without a reload.

## Troubleshooting

- **No Aiand models in the picker:** enable **Aiand** under **Manage Models**, then refresh models.
- **The API key is rejected:** create a fresh key in the Aiand dashboard and configure it again.
- **A request times out:** increase `aiandCopilot.requestTimeoutSeconds`.
- **An image is rejected:** select a Aiand model whose live metadata advertises image input.
- **Need a diagnostic snapshot:** run **Aiand: Show Diagnostics**. The report never includes the key.

The last successful model catalog and locally tracked usage snapshot are kept in VS Code global state for restart resilience. Inference retries only pre-stream network failures and HTTP 502/503/504 responses, at most twice, and honors bounded `Retry-After` delays.

The response reserve is distinct from the model's maximum output capability.
Input plus the reserved output equals the shared context window; live positive
context metadata remains authoritative even when output capability equals it.
