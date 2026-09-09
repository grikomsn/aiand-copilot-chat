/**
 * Inline-completion model candidates, ordered cheap-and-fast first.
 *
 * Badges are unmeasured defaults for the ai& catalog; latency and hidden-
 * reasoning behavior have not been benchmarked against api.aiand.com yet.
 * The QuickPick command renders this list and writes the selected id to
 * `aiandCopilot.inlineSuggestionsModel`, so choices need no reload. Unknown
 * model ids stay reachable through the command's custom entry and the raw
 * setting.
 *
 * Pure and unit-tested.
 */

export interface InlineModelCandidate {
  readonly id: string;
  /** Short measured/compatibility badge, e.g. "★ recommended · measured 1.3s TTFB". */
  readonly badge: string;
  /** One-line rationale shown under the model id. */
  readonly detail: string;
}

export const INLINE_MODEL_CANDIDATES: readonly InlineModelCandidate[] = [
  {
    id: "deepseek-ai/deepseek-v4-flash",
    badge: "★ default · fast flash tier",
    detail: "Lowest-latency ai& chat model; a sensible default for ghost text.",
  },
  {
    id: "openai/gpt-oss-120b",
    badge: "low cost",
    detail: "Cheapest per-token ai& model with reasoning support.",
  },
  {
    id: "google/gemma-4-31b-it",
    badge: "unmeasured",
    detail: "Mid-size instruct model; latency not yet benchmarked against ai&.",
  },
  {
    id: "qwen/qwen3.8-27b",
    badge: "unmeasured",
    detail: "Compact Qwen model; latency not yet benchmarked against ai&.",
  },
  {
    id: "qwen/qwen3.6-27b",
    badge: "unmeasured",
    detail: "Compact Qwen model; latency not yet benchmarked against ai&.",
  },
  {
    id: "zai-org/glm-5.2",
    badge: "unmeasured",
    detail: "GLM chat model; latency not yet benchmarked against ai&.",
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    badge: "unmeasured · larger",
    detail: "Larger DeepSeek model; prefer the flash tier for inline latency.",
  },
  {
    id: "moonshotai/kimi-k3",
    badge: "unmeasured · larger",
    detail: "Large Kimi model; prefer smaller tiers for inline latency.",
  },
  {
    id: "moonshotai/kimi-k2.7-code",
    badge: "unmeasured · code-tuned",
    detail: "Code-tuned Kimi model; may reason before emitting ghost text.",
  },
  {
    id: "zai-org/glm-5.3",
    badge: "unmeasured · larger",
    detail: "Larger GLM model; prefer smaller tiers for inline latency.",
  },
  {
    id: "motif-technologies/motif-3",
    badge: "unmeasured",
    detail: "Motif chat model; latency not yet benchmarked against ai&.",
  },
];

export interface InlineModelChoice {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly detail: string;
}

/** Build QuickPick-shaped choices, pinning an unlisted current id to the top. */
export function inlineModelChoices(currentId: string): InlineModelChoice[] {
  const listed = INLINE_MODEL_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.id === currentId ? `$(check) ${candidate.id}` : candidate.id,
    description: candidate.badge,
    detail: candidate.detail,
  }));
  const pinned = !INLINE_MODEL_CANDIDATES.some((candidate) => candidate.id === currentId)
    ? [{
      id: currentId,
      label: `$(check) ${currentId}`,
      description: "current value",
      detail: "Kept from your settings; not in the vetted list.",
    }]
    : [];
  return [...pinned, ...listed];
}
