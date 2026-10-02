export type ExternalContractPayment = {
  title: string;
  amount: string;
  dueDate: string;
  confidence: number;
};

export type ExternalContractExtraction = {
  vendorName: string | null;
  clientName: string | null;
  eventDate: string | null;
  location: string | null;
  currency: string | null;
  totalAmount: string | null;
  depositAmount: string | null;
  paymentSchedule: ExternalContractPayment[];
  serviceScope: string[];
  deliverables: string[];
  cancellation: string | null;
  postponement: string | null;
  forceMajeure: string | null;
  overtime: string | null;
  travel: string | null;
  termination: string | null;
  disputeResolution: string | null;
  unknowns: string[];
  overallConfidence: number;
};

type ResponsesPayload = {
  id?: unknown;
  output_text?: unknown;
  output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>;
  error?: { message?: unknown };
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = cleanText(item, maxLength);
    return text ? [text] : [];
  }).slice(0, maxItems);
}

function confidence(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function money(value: unknown) {
  const text = cleanText(value, 40);
  return text && /^\d+(?:\.\d{1,2})?$/.test(text) ? text : null;
}

function date(value: unknown) {
  const text = cleanText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function normalizeExternalContractExtraction(value: unknown): ExternalContractExtraction {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const currency = cleanText(row.currency, 3)?.toUpperCase() ?? null;
  return {
    vendorName: cleanText(row.vendorName, 200),
    clientName: cleanText(row.clientName, 200),
    eventDate: date(row.eventDate),
    location: cleanText(row.location, 300),
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    totalAmount: money(row.totalAmount),
    depositAmount: money(row.depositAmount),
    paymentSchedule: Array.isArray(row.paymentSchedule)
      ? row.paymentSchedule.flatMap((item): ExternalContractPayment[] => {
        if (!item || typeof item !== "object") return [];
        const payment = item as Record<string, unknown>;
        const title = cleanText(payment.title, 180);
        const amount = money(payment.amount);
        const dueDate = date(payment.dueDate);
        return title && amount && dueDate ? [{ title, amount, dueDate, confidence: confidence(payment.confidence) }] : [];
      }).slice(0, 24)
      : [],
    serviceScope: cleanList(row.serviceScope, 40, 500),
    deliverables: cleanList(row.deliverables, 40, 500),
    cancellation: cleanText(row.cancellation, 3000),
    postponement: cleanText(row.postponement, 3000),
    forceMajeure: cleanText(row.forceMajeure, 3000),
    overtime: cleanText(row.overtime, 2000),
    travel: cleanText(row.travel, 2000),
    termination: cleanText(row.termination, 3000),
    disputeResolution: cleanText(row.disputeResolution, 3000),
    unknowns: cleanList(row.unknowns, 30, 500),
    overallConfidence: confidence(row.overallConfidence),
  };
}

export function parseExternalContractResponse(payload: ResponsesPayload) {
  const direct = typeof payload.output_text === "string" ? payload.output_text : "";
  const nested = (payload.output ?? []).flatMap((item) => item.type === "message"
    ? (item.content ?? []).flatMap((content) => content.type === "output_text" && typeof content.text === "string" ? [content.text] : [])
    : []).join("");
  const text = (direct || nested).trim();
  if (!text) throw new Error(typeof payload.error?.message === "string" ? payload.error.message : "Contract analysis returned no structured result.");
  return normalizeExternalContractExtraction(JSON.parse(text));
}

export const externalContractExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "vendorName", "clientName", "eventDate", "location", "currency", "totalAmount", "depositAmount",
    "paymentSchedule", "serviceScope", "deliverables", "cancellation", "postponement", "forceMajeure",
    "overtime", "travel", "termination", "disputeResolution", "unknowns", "overallConfidence",
  ],
  properties: {
    vendorName: { type: ["string", "null"] },
    clientName: { type: ["string", "null"] },
    eventDate: { type: ["string", "null"], description: "ISO YYYY-MM-DD only when explicit." },
    location: { type: ["string", "null"] },
    currency: { type: ["string", "null"], description: "Three-letter currency code only when explicit." },
    totalAmount: { type: ["string", "null"], description: "Decimal digits only, without currency symbols or commas." },
    depositAmount: { type: ["string", "null"], description: "Decimal digits only, without currency symbols or commas." },
    paymentSchedule: {
      type: "array", maxItems: 24, items: {
        type: "object", additionalProperties: false, required: ["title", "amount", "dueDate", "confidence"],
        properties: {
          title: { type: "string" }, amount: { type: "string" }, dueDate: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    serviceScope: { type: "array", items: { type: "string" } },
    deliverables: { type: "array", items: { type: "string" } },
    cancellation: { type: ["string", "null"] }, postponement: { type: ["string", "null"] },
    forceMajeure: { type: ["string", "null"] }, overtime: { type: ["string", "null"] },
    travel: { type: ["string", "null"] }, termination: { type: ["string", "null"] },
    disputeResolution: { type: ["string", "null"] },
    unknowns: { type: "array", items: { type: "string" } },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;
