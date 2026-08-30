export type AiModelTier = "routine" | "balanced" | "complex";

export type AiRoutingMessage = {
  role?: string;
  content?: unknown;
};

export type AiModelRoute = {
  tier: AiModelTier;
  model: string;
  reason: string;
};

export type AiModelCatalog = Record<AiModelTier, string>;

const ROUTINE_ACTION_PATTERN = /\b(add|create|remove|delete|mark|complete|update|change|set|record|show|list|find|check)\b/i;
const COMPLEX_SIGNAL_PATTERNS = [
  /\b(strategy|strategic|trade-?offs?|compare|comparison|evaluate|analyse|analyze|recommend(?:ation)?|prioriti[sz]e)\b/i,
  /\b(plan|roadmap|timeline|schedule)\b.{0,80}\b(entire|full|complete|end-to-end|next (?:month|quarter|year))\b/i,
  /\b(reallocate|optimi[sz]e|scenario|contingency|dependencies|risks?|constraints?)\b/i,
  /\b(budget|vendors?|guests?|timeline|tasks?)\b.{0,120}\b(budget|vendors?|guests?|timeline|tasks?)\b/i,
];

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => typeof part === "string" ? part : String(part?.text ?? ""))
    .join(" ");
}

/**
 * Routes without an extra model call so classification never consumes the
 * savings it is intended to create. Ambiguous requests deliberately land on
 * the balanced tier; only strong complexity signals promote a request to Sol.
 */
export function selectAiModelRoute(
  messages: AiRoutingMessage[],
  models: AiModelCatalog,
): AiModelRoute {
  const userMessages = messages.filter((message) => message?.role === "user");
  const latest = messageText(userMessages.at(-1)?.content).trim();
  const normalized = latest.replace(/\s+/g, " ");

  let complexityScore = 0;
  const reasons: string[] = [];

  for (const pattern of COMPLEX_SIGNAL_PATTERNS) {
    if (pattern.test(normalized)) complexityScore += 2;
  }
  if (normalized.length > 700) {
    complexityScore += 2;
    reasons.push("long request");
  } else if (normalized.length > 350) {
    complexityScore += 1;
  }
  if ((normalized.match(/[;\n]/g)?.length ?? 0) >= 3) {
    complexityScore += 1;
    reasons.push("multiple constraints");
  }
  if (userMessages.length >= 5) {
    complexityScore += 1;
    reasons.push("extended workflow");
  }

  if (complexityScore >= 4) {
    return {
      tier: "complex",
      model: models.complex,
      reason: reasons[0] ?? "multi-domain planning or analysis",
    };
  }

  const isShort = normalized.length <= 220;
  const isRoutineAction = ROUTINE_ACTION_PATTERN.test(normalized);
  const isSimpleQuestion = isShort && /^(what|when|where|who|how many|do i|is there|are there|can you)\b/i.test(normalized);

  if (isShort && (isRoutineAction || isSimpleQuestion) && complexityScore === 0) {
    return {
      tier: "routine",
      model: models.routine,
      reason: isRoutineAction ? "single-step action or lookup" : "short factual question",
    };
  }

  return {
    tier: "balanced",
    model: models.balanced,
    reason: "standard planning assistance",
  };
}

export type ModelPricing = {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
};

const DEFAULT_PRICING_PER_MILLION: Record<string, ModelPricing> = {
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 },
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 },
  "gpt-5.6-sol": { input: 5, cachedInput: 0.5, cacheWrite: 6.25, output: 30 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, cacheWrite: 0.4, output: 1.6 },
};

export function getDefaultModelPricing(model: string): ModelPricing {
  return DEFAULT_PRICING_PER_MILLION[model] ?? {
    input: 0,
    cachedInput: 0,
    cacheWrite: 0,
    output: 0,
  };
}
