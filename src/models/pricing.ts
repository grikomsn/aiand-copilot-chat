export interface ModelCost {
  readonly input: number;
  readonly output: number;
  readonly cacheRead?: number;
}

export interface ModelPricingFields {
  readonly pricing: string;
  readonly inputCost: number;
  readonly outputCost: number;
  readonly cacheCost?: number;
  readonly priceCategory: "low" | "medium" | "high" | "very_high";
}

const OFFICIAL_MODEL_COSTS: Readonly<Record<string, ModelCost>> = {
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  "deepseek-ai/deepseek-v4-flash": { input: 0.15, output: 0.25 },
  "deepseek-ai/deepseek-v4-pro": { input: 1, output: 2.5 },
  "moonshotai/kimi-k3": { input: 3, output: 12.5 },
  "moonshotai/kimi-k2.7-code": { input: 0.75, output: 3.5 },
  "zai-org/glm-5.3": { input: 1, output: 4 },
  "zai-org/glm-5.2": { input: 1, output: 4 },
  "google/gemma-4-31b-it": { input: 0.2, output: 0.5 },
  "qwen/qwen3.8-27b": { input: 0.4, output: 3 },
  "qwen/qwen3.6-27b": { input: 0.32, output: 3.2 },
  "motif-technologies/motif-3": { input: 0.5, output: 2 },
};

export function aiandModelCost(id: string, discovered?: ModelCost): ModelCost | undefined {
  return discovered ?? OFFICIAL_MODEL_COSTS[id];
}

/**
 * Converts the per-million pricing from `GET /v1/models` into costs.
 * ai& reports rates already per 1M tokens as decimal strings
 * (e.g. `"input_per_1m": "0.15"` or `{ "prompt": "0.35" }`), so the
 * values pass through unchanged; no per-token scaling is applied.
 */
export function modelCostFromApi(value: unknown): ModelCost | undefined {
  const pricing = record(value);
  if (!pricing) return undefined;
  const input = nonNegativeNumber(pricing.prompt ?? pricing.input_per_1m ?? pricing.input);
  const output = nonNegativeNumber(pricing.completion ?? pricing.output_per_1m ?? pricing.output);
  if (input === undefined || output === undefined) return undefined;
  const cacheRead = nonNegativeNumber(pricing.cache_prompt);
  return {
    input,
    output,
    ...(cacheRead === undefined ? {} : { cacheRead }),
  };
}

export function modelPricingFields(cost: ModelCost | undefined): ModelPricingFields | undefined {
  if (!cost) return undefined;
  if (cost.input === 0 && cost.output === 0) {
    return {
      pricing: "Free",
      inputCost: 0,
      outputCost: 0,
      ...(cost.cacheRead === undefined ? {} : { cacheCost: 0 }),
      priceCategory: "low",
    };
  }
  return {
    pricing: `In: $${formatPrice(cost.input)} · Out: $${formatPrice(cost.output)} /1M tokens`,
    inputCost: Math.round(cost.input * 100),
    outputCost: Math.round(cost.output * 100),
    ...(cost.cacheRead === undefined ? {} : { cacheCost: Math.round(cost.cacheRead * 100) }),
    priceCategory: costCategory(cost),
  };
}

export function costCategory(cost: Pick<ModelCost, "input" | "output">): ModelPricingFields["priceCategory"] {
  const weighted = cost.input * 3 + cost.output;
  if (weighted <= 2) return "low";
  if (weighted <= 25) return "medium";
  if (weighted <= 50) return "high";
  return "very_high";
}

function formatPrice(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
