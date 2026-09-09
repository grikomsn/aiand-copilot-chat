import * as vscode from "vscode";
import { registerInlineCompletions } from "./autocomplete";
import { AiandAuth } from "./auth/auth";
import { registerCommands } from "./commands/commands";
import { messageOf } from "./errors";
import { AiandProvider } from "./provider";
import { extensionUserAgent } from "./transport/protocol";
import { renderUsageStatus, updateUsageStatusVisibility } from "./usage/presentation";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Aiand");
  const auth = new AiandAuth(context.secrets);
  const provider = new AiandProvider(
    auth,
    output,
    extensionUserAgent(context.extension.packageJSON.version, vscode.version),
    context.globalState,
  );
  const usageStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 92);
  usageStatus.name = "Aiand account balance";
  usageStatus.command = "aiandCopilot.showUsage";
  renderUsageStatus(usageStatus, provider.getUsageSnapshot());
  updateUsageStatusVisibility(usageStatus);

  context.subscriptions.push(
    output,
    usageStatus,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("aiandCopilot.reasoningEffort") ||
        event.affectsConfiguration("aiandCopilot.catalogCacheMinutes")
      ) {
        provider.fireDidChange();
      }
      if (event.affectsConfiguration("aiandCopilot.showUsageStatusBar")) updateUsageStatusVisibility(usageStatus);
    }),
    provider.onDidChangeUsage(({ credentialRef, usage }) => {
      if (credentialRef === provider.getActiveCredentialRef()) renderUsageStatus(usageStatus, usage);
    }),
    vscode.lm.registerLanguageModelChatProvider("aiand", provider),
    ...registerCommands(auth, provider, output),
    registerInlineCompletions(context, {
      resolveApiKey: () => auth.getApiKey(),
      output,
      version: context.extension.packageJSON.version as string,
      vscodeVersion: vscode.version,
    }),
  );

  output.appendLine(
    `[activate] Aiand for Copilot Chat ${context.extension.packageJSON.version} on VS Code ${vscode.version}`,
  );
  void auth.hasApiKey().then((configured) => {
    if (!configured) return;
    void provider.refreshModels().catch((error) => {
      output.appendLine(`[models] initial refresh failed: ${messageOf(error)}`);
    });
    void provider.refreshUsage().catch((error) => {
      output.appendLine(`[usage] initial refresh failed: ${messageOf(error)}`);
    });
  });
}
