---
"aiand-copilot-chat": minor
---

Scope reasoning effort per model. The Copilot Chat Reasoning Effort picker now lists exactly the efforts each ai& model accepts (from the live `reasoning_efforts` catalog field), adds the `xhigh` and `max` levels several models support, and never sends an effort the model would reject with HTTP 400. The workspace default applies only when the model supports it, otherwise the model's own default is used; models without reasoning control omit the parameter entirely. Inline suggestions now use the suggestion model's reasoning-off effort instead of assuming `none`.
