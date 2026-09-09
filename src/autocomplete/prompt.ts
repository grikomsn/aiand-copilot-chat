/**
 * Prompt construction for the Aiand chat-completions completion engine.
 *
 * Aiand exposes no FIM endpoint, so fill-in-the-middle is emulated with FIM
 * delimiter tokens inline over the fixed `/chat/completions` endpoint, and
 * reasoning is disabled with the accepted `reasoning_effort: "none"` value.
 * Inline latency has not been benchmarked against Aiand yet; the default
 * flash-tier model is chosen for its low cost and latency class, not from
 * live measurements.
 *
 * Pure and unit-tested.
 */

export interface CompletionPrompt {
  readonly messages: ReadonlyArray<{ role: string; content: string }>;
  /** Extra body fields (the reasoning-off switch). */
  readonly extra: Readonly<Record<string, unknown>>;
}

export const COMPLETION_SYSTEM_PROMPT = "Return only the missing code at the cursor. No explanations, no markdown.";

export const INLINE_REASONING_EFFORT = "none";

const FIM = { prefix: "<|fim_prefix|>", suffix: "<|fim_suffix|>", middle: "<|fim_middle|>" } as const;

export function buildCompletionPrompt(prefix: string, suffix: string): CompletionPrompt {
  return {
    messages: [
      { role: "system", content: COMPLETION_SYSTEM_PROMPT },
      { role: "user", content: `${FIM.prefix}${prefix}${FIM.suffix}${suffix}${FIM.middle}` },
    ],
    extra: { reasoning_effort: INLINE_REASONING_EFFORT },
  };
}

/**
 * Remove special-token artifacts from a suggestion. Models occasionally echo
 * the injected FIM delimiters (`<|fim_prefix|>`…) or tokenizer specials such
 * as `<|file_separator|>` into their visible stream; ghost text must never
 * show them. Only token-shaped `<|word|>` strings are removed, so shell- or
 * OCaml-style `<|` operators without a matching `|>` pair survive untouched.
 * Pure and unit-tested.
 */
const SPECIAL_TOKEN_PATTERN = /<\|[A-Za-z0-9_.-]{1,48}\|>/g;

export function stripSpecialTokens(text: string): string {
  return text.replace(SPECIAL_TOKEN_PATTERN, "");
}
