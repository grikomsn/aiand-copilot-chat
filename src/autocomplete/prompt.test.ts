import assert from "node:assert/strict";
import test from "node:test";
import { buildCompletionPrompt, COMPLETION_SYSTEM_PROMPT, completionReasoningEffort, INLINE_REASONING_EFFORT, stripSpecialTokens } from "./prompt";

test("emulates fill-in-the-middle with FIM tokens", () => {
  const prompt = buildCompletionPrompt("before", "after");
  assert.equal(prompt.messages[0]?.content, COMPLETION_SYSTEM_PROMPT);
  assert.equal(
    prompt.messages[1]?.content,
    "<|fim_prefix|>before<|fim_suffix|>after<|fim_middle|>",
  );
});

test("sends the measured reasoning-off switch when the model accepts it", () => {
  assert.equal(INLINE_REASONING_EFFORT, "none");
  assert.deepEqual(buildCompletionPrompt("a", "b", ["none", "high"]).extra, { reasoning_effort: "none" });
});

test("picks the lightest listed effort when the model has no off switch", () => {
  // kimi-k2.7-code only accepts "high".
  assert.equal(completionReasoningEffort(["high"]), "high");
  assert.deepEqual(buildCompletionPrompt("a", "b", ["high"]).extra, { reasoning_effort: "high" });
  // gpt-oss-120b accepts low/medium/high → lightest is low.
  assert.equal(completionReasoningEffort(["low", "medium", "high"]), "low");
  assert.deepEqual(buildCompletionPrompt("a", "b", ["low", "medium", "high"]).extra, { reasoning_effort: "low" });
});

test("omits the reasoning field when the model has no reasoning control", () => {
  assert.equal(completionReasoningEffort(undefined), undefined);
  assert.equal(completionReasoningEffort([]), undefined);
  assert.deepEqual(buildCompletionPrompt("a", "b").extra, {});
});

test("strips echoed special tokens from suggestions", () => {
  assert.equal(stripSpecialTokens("<|file_separator|>    out.append(x)"), "    out.append(x)");
  assert.equal(stripSpecialTokens("    out.append(x)<|fim_middle|>"), "    out.append(x)");
  assert.equal(stripSpecialTokens("<|fim_prefix|>a<|fim_suffix|>b<|fim_middle|>c"), "abc");
  assert.equal(stripSpecialTokens("    out.append(x)"), "    out.append(x)");
  assert.equal(stripSpecialTokens("echo <| b; # no closing pair"), "echo <| b; # no closing pair");
  assert.equal(stripSpecialTokens("<|file_separator|>"), "");
});
