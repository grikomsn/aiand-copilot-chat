/** User-facing ai& commands and connection workflows. */

import * as vscode from "vscode";
import { CONFIG_SECTION, DEFAULT_INLINE_MODEL, INLINE_SUGGESTIONS_MODEL_SETTING } from "../autocomplete/config";
import { inlineModelChoices } from "../autocomplete/models";
import { AiandAuth } from "../auth/auth";
import { messageOf } from "../errors";
import { API_BASE, AiandProvider } from "../provider";
import { formatUsageRows, type UsageDisplayRow } from "../usage/domain";

const API_KEYS_URL = "https://console.aiand.com/settings/api-keys";

export function registerCommands(
  auth: AiandAuth,
  provider: AiandProvider,
  output: vscode.OutputChannel,
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("aiandCopilot.manage", () => manage(auth, provider, output)),
    vscode.commands.registerCommand("aiandCopilot.configureApiKey", () => configureApiKey(provider, output)),
    vscode.commands.registerCommand("aiandCopilot.removeApiKey", () => removeApiKey(provider)),
    vscode.commands.registerCommand("aiandCopilot.refreshModels", () => refreshModels(provider)),
    vscode.commands.registerCommand("aiandCopilot.setInlineSuggestionsModel", () => setInlineSuggestionsModel()),
    vscode.commands.registerCommand("aiandCopilot.showUsage", () => showUsage(provider, output)),
    vscode.commands.registerCommand("aiandCopilot.testConnection", () => testConnection(provider, output)),
    vscode.commands.registerCommand("aiandCopilot.openApiKeys", () => openApiKeys()),
    vscode.commands.registerCommand("aiandCopilot.diagnostics", () => diagnostics(auth, output)),
  ];
}

async function manage(auth: AiandAuth, provider: AiandProvider, output: vscode.OutputChannel): Promise<void> {
  const configured = await auth.hasApiKey();
  const choices = configured
    ? [
        { label: "$(check) Test ai& inference", action: "test" },
        { label: "$(refresh) Refresh hosted models", action: "refresh" },
        { label: "$(zap) Set inline suggestions model", action: "inlineModel" },
        { label: "$(credit-card) Show credits and usage", action: "usage" },
        { label: "$(key) Replace API key", action: "configure" },
        { label: "$(link-external) Open ai& API keys", action: "open" },
        { label: "$(output) Show ai& logs", action: "logs" },
        { label: "$(info) Show diagnostics", action: "diagnostics" },
        { label: "$(trash) Remove API key", action: "remove" },
      ]
    : [
        { label: "$(key) Configure ai& API key", action: "configure" },
        { label: "$(link-external) Open ai& API keys", action: "open" },
        { label: "$(output) Show ai& logs", action: "logs" },
      ];
  const picked = await vscode.window.showQuickPick(choices, {
    title: `ai& — API key ${configured ? "configured" : "not configured"}`,
  });
  if (!picked) return;
  if (picked.action === "configure") await configureApiKey(provider, output);
  else if (picked.action === "refresh") await refreshModels(provider);
  else if (picked.action === "inlineModel") await setInlineSuggestionsModel();
  else if (picked.action === "test") await testConnection(provider, output);
  else if (picked.action === "usage") await showUsage(provider, output);
  else if (picked.action === "open") await openApiKeys();
  else if (picked.action === "logs") output.show(true);
  else if (picked.action === "diagnostics") await diagnostics(auth, output);
  else if (picked.action === "remove") await removeApiKey(provider);
}

async function configureApiKey(provider: AiandProvider, output: vscode.OutputChannel): Promise<boolean> {
  const apiKey = await vscode.window.showInputBox({
    title: "Configure ai& API key",
    prompt: "The key is validated with ai&, then stored in VS Code Secret Storage.",
    placeHolder: "Paste your ai& API key",
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value.trim() ? undefined : "Enter an ai& API key"),
  });
  if (!apiKey) return false;

  try {
    const models = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Validating ai& API key…",
      },
      () => provider.configureApiKey(apiKey),
    );
    output.appendLine(`[auth] API key configured; models=${models.join(",")}`);
    vscode.window.showInformationMessage(`ai& connected. Found ${models.length} hosted models.`);
    return true;
  } catch (error) {
    const message = messageOf(error);
    output.appendLine(`[auth] API key validation failed: ${message}`);
    vscode.window.showErrorMessage(`ai& API key was not saved: ${message}`);
    return false;
  }
}

async function removeApiKey(provider: AiandProvider): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    "Remove the ai& API key from VS Code Secret Storage?",
    { modal: true },
    "Remove API Key",
  );
  if (choice !== "Remove API Key") return;
  await provider.clearApiKey();
  vscode.window.showInformationMessage("ai& API key removed.");
}

async function refreshModels(provider: AiandProvider): Promise<void> {
  try {
    const models = await provider.refreshModels();
    vscode.window.showInformationMessage(`Refreshed ${models.length} ai& hosted models.`);
  } catch (error) {
    vscode.window.showErrorMessage(messageOf(error));
  }
}

interface InlineModelPickItem extends vscode.QuickPickItem {
  readonly action?: string | "custom";
}

async function setInlineSuggestionsModel(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const current = configuration.get<string>(INLINE_SUGGESTIONS_MODEL_SETTING, DEFAULT_INLINE_MODEL) ?? DEFAULT_INLINE_MODEL;
  const picked = await vscode.window.showQuickPick<InlineModelPickItem>([
    ...inlineModelChoices(current).map((choice) => ({
      label: choice.label,
      description: choice.description,
      detail: choice.detail,
      action: choice.id,
    })),
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    { label: "$(pencil) Use a custom model id…", detail: "Enter any ai& model id that completes cleanly at reasoning_effort none.", action: "custom" as const },
  ], {
    title: "ai& — Set Inline Suggestions Model",
    placeHolder: `Current: ${current}`,
  });
  if (!picked?.action) return;
  if (picked.action === "custom") {
    const value = await vscode.window.showInputBox({
      title: "Custom inline suggestions model id",
      value: current,
      prompt: "Any ai& model id; the vetted list is a starting point, not a restriction.",
    });
    if (value === undefined || !value.trim()) return;
    await configuration.update(INLINE_SUGGESTIONS_MODEL_SETTING, value.trim(), vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`ai& inline suggestions model set to ${value.trim()}.`);
    return;
  }
  await configuration.update(INLINE_SUGGESTIONS_MODEL_SETTING, picked.action, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(`ai& inline suggestions model set to ${picked.action}. Applies on the next keystroke.`);
}

async function testConnection(provider: AiandProvider, output: vscode.OutputChannel): Promise<void> {
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Testing ai& inference…",
      },
      () => provider.testConnection(),
    );
    output.appendLine(
      `[test] model=${result.model} effort=${result.reasoningEffort ?? "model-default"} response=${result.text}`,
    );
    vscode.window.showInformationMessage(
      `ai& verified with ${result.model}${result.reasoningEffort ? ` (${result.reasoningEffort} effort)` : ""}: ${result.text}`,
    );
  } catch (error) {
    const message = messageOf(error);
    output.appendLine(`[test] ${message}`);
    vscode.window.showErrorMessage(`ai& connection test failed: ${message}`);
  }
}

async function openApiKeys(): Promise<void> {
  const opened = await vscode.env.openExternal(vscode.Uri.parse(API_KEYS_URL));
  if (!opened) vscode.window.showWarningMessage("VS Code could not open the ai& dashboard.");
}

interface UsageQuickPickItem extends vscode.QuickPickItem {
  action?: "refresh" | "configure";
}

async function showUsage(provider: AiandProvider, output: vscode.OutputChannel): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Refreshing ai& credit balance and usage…",
      },
      () => provider.refreshUsage(),
    );
  } catch (error) {
    output.appendLine(`[usage] manual refresh failed: ${messageOf(error)}`);
  }
  const rows = formatUsageRows(provider.getUsageSnapshot()).map(toUsageQuickPickItem);
  const picked = await vscode.window.showQuickPick(
    [
      ...rows,
      { label: "Actions", kind: vscode.QuickPickItemKind.Separator },
      { label: "$(refresh) Refresh usage", action: "refresh" },
      { label: "$(key) Configure or replace API key", action: "configure" },
    ] satisfies UsageQuickPickItem[],
    {
      title: "ai& usage",
      placeHolder: "Live credit balance plus locally tracked inference tokens",
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );
  if (picked?.action === "refresh") await showUsage(provider, output);
  else if (picked?.action === "configure") await configureApiKey(provider, output);
}

function toUsageQuickPickItem(row: UsageDisplayRow): UsageQuickPickItem {
  const icons: Record<UsageDisplayRow["kind"], string> = {
    credits: "$(credit-card)",
    allowance: "$(calendar)",
    tracked: "$(symbol-numeric)",
    request: "$(history)",
    warning: "$(warning)",
    empty: "$(info)",
  };
  return {
    label: `${icons[row.kind]} ${row.label}`,
    description: row.description,
    detail: row.detail,
  };
}

async function diagnostics(auth: AiandAuth, output: vscode.OutputChannel): Promise<void> {
  const models = await vscode.lm.selectChatModels({ vendor: "aiand" });
  const lines = [
    "# ai& for Copilot Chat diagnostics",
    "",
    `- VS Code: ${vscode.version}`,
    `- API endpoint: ${API_BASE}`,
    `- API key: ${(await auth.hasApiKey()) ? "configured in Secret Storage" : "missing"}`,
    `- Default reasoning effort: ${vscode.workspace.getConfiguration("aiandCopilot").get("reasoningEffort", "high")}`,
    `- Registered models: ${models.length}`,
    "",
    ...models.map((model) => `- ${model.id} (${model.maxInputTokens} input tokens)`),
  ];
  output.appendLine(`[diagnostics] models=${models.length}`);
  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
}
