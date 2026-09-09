import * as vscode from "vscode";
import { formatUsageStatusBar, formatUsageTooltip, type AiandUsageSnapshot } from "./domain";

export function renderUsageStatus(item: vscode.StatusBarItem, snapshot: AiandUsageSnapshot): void {
  item.text = formatUsageStatusBar(snapshot);
  item.tooltip = formatUsageTooltip(snapshot);
}

export function updateUsageStatusVisibility(item: vscode.StatusBarItem): void {
  if (vscode.workspace.getConfiguration("aiandCopilot").get("showUsageStatusBar", true)) item.show();
  else item.hide();
}
