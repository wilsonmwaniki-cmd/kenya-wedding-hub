import { WeddingBriefingError, type BriefingDatabase } from "./weddingBriefing.ts";

export type VendorSearchArguments = {
  category: string;
  location?: string;
  budgetMinKes?: number;
  budgetMaxKes?: number;
  services?: string[];
  limit?: number;
};

export type VendorSearchEvidence = {
  sourceKind: "zania_listing";
  sourceRecordId: string;
  observedAt: string;
  facts: Array<{ field: string; value: string | number | boolean }>;
};

export type VendorSearchMatch = {
  id: string;
  businessName: string;
  category: string;
  description: string | null;
  location: string | null;
  website: string | null;
  services: string[];
  serviceAreas: string[];
  travelScope: string | null;
  minimumBudgetKes: number | null;
  maximumBudgetKes: number | null;
  isVerified: boolean;
  profileStatus: "claimed" | "unclaimed";
  matchReasons: string[];
  unknowns: string[];
  evidence: VendorSearchEvidence;
};

export type VendorSearchResult = {
  intent: VendorSearchArguments;
  matches: VendorSearchMatch[];
  searchedSource: "zania_directory";
  sourceCoverage: "internal_only";
};

type VendorListingRow = {
  id: string;
  user_id: string | null;
  business_name: string;
  category: string;
  description: string | null;
  website: string | null;
  location: string | null;
  location_town: string | null;
  location_county: string | null;
  services: string[] | null;
  service_areas: string[] | null;
  travel_scope: string | null;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
  is_verified: boolean;
  profile_kind: string | null;
  updated_at: string;
};

const categoryAliases: Array<[RegExp, string]> = [
  [/\b(?:wedding\s+)?venues?\b/i, "wedding venue"],
  [/\b(?:photographers?|photography)\b/i, "photographer"],
  [/\b(?:videographers?|videography|cinematographers?)\b/i, "cinematographer"],
  [/\b(?:caterers?|catering)\b/i, "caterer"],
  [/\b(?:decorators?|decor|décor|florists?)\b/i, "décor, tents, chairs, tables"],
  [/\b(?:djs?|bands?|music|sound)\b/i, "dj (or band) and sound"],
  [/\b(?:mcs?|emcees?|masters? of ceremonies)\b/i, "master of ceremonies"],
  [/\b(?:cake artists?|bakers?|cakes?)\b/i, "cake artist & baker"],
  [/\b(?:make-?up artists?|muas?)\b/i, "bride's make-up artist"],
  [/\b(?:hair stylists?|hairdressers?)\b/i, "bride's hair stylist"],
  [/\b(?:wedding planners?|planners?)\b/i, "wedding planner / planning team"],
  [/\b(?:stationery|invitations?)\b/i, "invitations"],
  [/\b(?:rings?|wedding bands?)\b/i, "rings"],
];

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function canonicalCategory(value: string) {
  const match = categoryAliases.find(([pattern]) => pattern.test(value));
  return match?.[1] ?? normalize(value);
}

function parseAmount(value: string, suffix?: string) {
  const base = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  if (suffix?.toLowerCase() === "k") return base * 1_000;
  if (suffix?.toLowerCase() === "m") return base * 1_000_000;
  return base;
}

export function parseVendorSearchPrompt(prompt: string): VendorSearchArguments | null {
  const text = prompt.trim();
  if (!text || !/\b(find|search|recommend|suggest|looking for|need)\b/i.test(text)) return null;
  const category = categoryAliases.find(([pattern]) => pattern.test(text))?.[1];
  if (!category) return null;

  const locationMatch = text.match(/\b(?:in|near|around)\s+([a-z][a-z .'-]{1,60}?)(?=\s+(?:under|below|up to|within|with|for|budget|between|from)\b|[?.!,]|$)/i);
  const maxMatch = text.match(/\b(?:under|below|up to|maximum|max|budget(?:\s+of)?|within)\s*(?:kes|kshs?|ksh)?\s*([\d,.]+)\s*([km])?\b/i);
  const rangeMatch = text.match(/\b(?:between|from)\s*(?:kes|kshs?|ksh)?\s*([\d,.]+)\s*([km])?\s*(?:and|to|-)\s*(?:kes|kshs?|ksh)?\s*([\d,.]+)\s*([km])?\b/i);

  const result: VendorSearchArguments = { category };
  if (locationMatch?.[1]) result.location = locationMatch[1].trim();
  if (rangeMatch) {
    result.budgetMinKes = parseAmount(rangeMatch[1], rangeMatch[2]);
    result.budgetMaxKes = parseAmount(rangeMatch[3], rangeMatch[4]);
  } else if (maxMatch) {
    result.budgetMaxKes = parseAmount(maxMatch[1], maxMatch[2]);
  }
  return result;
}

function validateArguments(input: VendorSearchArguments): VendorSearchArguments {
  const category = canonicalCategory(String(input.category ?? "")).slice(0, 120);
  if (!category) throw new WeddingBriefingError("Tell Zania which kind of vendor you need.", 400);
  const budgetMinKes = input.budgetMinKes == null ? undefined : Number(input.budgetMinKes);
  const budgetMaxKes = input.budgetMaxKes == null ? undefined : Number(input.budgetMaxKes);
  if (budgetMinKes != null && (!Number.isFinite(budgetMinKes) || budgetMinKes < 0)) {
    throw new WeddingBriefingError("The minimum vendor budget must be a valid positive amount.", 400);
  }
  if (budgetMaxKes != null && (!Number.isFinite(budgetMaxKes) || budgetMaxKes <= 0)) {
    throw new WeddingBriefingError("The maximum vendor budget must be a valid positive amount.", 400);
  }
  if (budgetMinKes != null && budgetMaxKes != null && budgetMinKes > budgetMaxKes) {
    throw new WeddingBriefingError("The minimum vendor budget cannot be greater than the maximum.", 400);
  }
  return {
    category,
    ...(input.location?.trim() ? { location: input.location.trim().slice(0, 120) } : {}),
    ...(budgetMinKes != null ? { budgetMinKes } : {}),
    ...(budgetMaxKes != null ? { budgetMaxKes } : {}),
    ...(input.services?.length ? { services: input.services.map((item) => item.trim()).filter(Boolean).slice(0, 10) } : {}),
    limit: Math.min(10, Math.max(1, Number(input.limit ?? 5))),
  };
}

function budgetOverlaps(row: VendorListingRow, intent: VendorSearchArguments) {
  if (intent.budgetMinKes == null && intent.budgetMaxKes == null) return null;
  if (row.minimum_budget_kes == null || row.maximum_budget_kes == null) return null;
  const requestedMin = intent.budgetMinKes ?? 0;
  const requestedMax = intent.budgetMaxKes ?? Number.POSITIVE_INFINITY;
  return row.minimum_budget_kes <= requestedMax && row.maximum_budget_kes >= requestedMin;
}

function scoreListing(row: VendorListingRow, intent: VendorSearchArguments) {
  const reasons: string[] = [];
  let score = 0;
  const rowCategory = canonicalCategory(row.category);
  if (rowCategory === intent.category) {
    score += 40;
    reasons.push("Matches the requested service");
  } else if (`${rowCategory} ${normalize(row.description ?? "")} ${(row.services ?? []).map(normalize).join(" ")}`.includes(normalize(intent.category))) {
    score += 20;
    reasons.push("Mentions the requested service");
  } else {
    return null;
  }

  if (intent.location) {
    const requestedLocation = normalize(intent.location);
    const locationValues = [row.location, row.location_town, row.location_county, ...(row.service_areas ?? [])]
      .filter((value): value is string => Boolean(value)).map(normalize);
    if (locationValues.some((value) => value.includes(requestedLocation) || requestedLocation.includes(value))) {
      score += 25;
      reasons.push("Serves the requested location");
    } else if (row.travel_scope === "nationwide") {
      score += 10;
      reasons.push("Lists nationwide travel");
    } else if (locationValues.length) {
      return null;
    }
  }

  const budgetMatch = budgetOverlaps(row, intent);
  if (budgetMatch === true) {
    score += 20;
    reasons.push("Published range overlaps the requested budget");
  } else if (budgetMatch === false) {
    return null;
  }
  if (intent.services?.length) {
    const offered = normalize(`${row.description ?? ""} ${(row.services ?? []).join(" ")}`);
    const matchedServices = intent.services.filter((service) => offered.includes(normalize(service)));
    if (matchedServices.length) {
      score += Math.min(15, matchedServices.length * 5);
      reasons.push(`Mentions ${matchedServices.join(", ")}`);
    }
  }
  if (row.is_verified) {
    score += 5;
    reasons.push("Zania-verified listing");
  }
  if (row.user_id) score += 2;
  return { score, reasons, budgetMatch };
}

export async function searchZaniaVendors(
  db: BriefingDatabase,
  actor: { role: string },
  rawArguments: VendorSearchArguments,
): Promise<VendorSearchResult> {
  if (actor.role !== "couple" && actor.role !== "planner") {
    throw new WeddingBriefingError("Vendor discovery is available to couples and planners.", 403);
  }
  const intent = validateArguments(rawArguments);
  const { data, error } = await db.from("vendor_listings")
    .select("id,user_id,business_name,category,description,website,location,location_town,location_county,services,service_areas,travel_scope,minimum_budget_kes,maximum_budget_kes,is_verified,profile_kind,updated_at")
    .eq("is_approved", true)
    .eq("directory_opt_out", false)
    .limit(500);
  if (error || !data) throw new WeddingBriefingError("Could not search the Zania vendor directory. Please try again.", 503);

  const preferred = new Map<string, { row: VendorListingRow; score: number; reasons: string[]; budgetMatch: boolean | null }>();
  for (const rawRow of data as unknown as VendorListingRow[]) {
    const scored = scoreListing(rawRow, intent);
    if (!scored) continue;
    const key = normalize(rawRow.business_name) || rawRow.id;
    const current = preferred.get(key);
    if (!current || scored.score > current.score || (scored.score === current.score && rawRow.updated_at > current.row.updated_at)) {
      preferred.set(key, { row: rawRow, ...scored });
    }
  }

  const matches = [...preferred.values()]
    .sort((left, right) => right.score - left.score || left.row.business_name.localeCompare(right.row.business_name))
    .slice(0, intent.limit)
    .map(({ row, score, reasons, budgetMatch }): VendorSearchMatch => {
      const derivedLocation = [row.location_town, row.location_county].filter(Boolean).join(", ");
      const location = row.location ?? (derivedLocation || null);
      const unknowns = [
        ...(!row.minimum_budget_kes || !row.maximum_budget_kes ? ["Current price range is not published"] : []),
        ...(!row.website ? ["Website is not published"] : []),
        ...(intent.location && !reasons.some((reason) => reason.includes("location") || reason.includes("travel")) ? ["Service in the requested location is not confirmed"] : []),
        ...(intent.services?.length && !intent.services.some((service) => (
          normalize(`${row.description ?? ""} ${(row.services ?? []).join(" ")}`).includes(normalize(service))
        ))
          ? ["Requested service details are not confirmed in this listing"] : []),
      ];
      const facts: VendorSearchEvidence["facts"] = [
        { field: "business_name", value: row.business_name },
        { field: "category", value: row.category },
        { field: "is_verified", value: row.is_verified },
      ];
      if (location) facts.push({ field: "location", value: location });
      if (row.website) facts.push({ field: "website", value: row.website });
      if (row.services?.length) facts.push({ field: "services", value: row.services.join(", ") });
      if (row.service_areas?.length) facts.push({ field: "service_areas", value: row.service_areas.join(", ") });
      if (row.travel_scope) facts.push({ field: "travel_scope", value: row.travel_scope });
      if (row.minimum_budget_kes != null) facts.push({ field: "minimum_budget_kes", value: row.minimum_budget_kes });
      if (row.maximum_budget_kes != null) facts.push({ field: "maximum_budget_kes", value: row.maximum_budget_kes });
      return {
        id: row.id,
        businessName: row.business_name,
        category: row.category,
        description: row.description,
        location,
        website: row.website,
        services: row.services ?? [],
        serviceAreas: row.service_areas ?? [],
        travelScope: row.travel_scope,
        minimumBudgetKes: row.minimum_budget_kes,
        maximumBudgetKes: row.maximum_budget_kes,
        isVerified: row.is_verified,
        profileStatus: row.user_id || row.profile_kind === "claimed" ? "claimed" : "unclaimed",
        matchReasons: reasons,
        unknowns,
        evidence: { sourceKind: "zania_listing", sourceRecordId: row.id, observedAt: row.updated_at, facts },
      };
    });

  return { intent, matches, searchedSource: "zania_directory", sourceCoverage: "internal_only" };
}
