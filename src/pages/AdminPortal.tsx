import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, Users, Store, CheckSquare, UserCog, AlertTriangle, MessageSquareWarning, Calculator, BadgeDollarSign, History, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePageSkeleton } from "@/components/AppLoadingSkeletons";

interface AdminDashboardMetrics {
  total_users: number;
  total_couples: number;
  total_planners: number;
  total_vendors: number;
  total_admins: number;
  total_vendor_listings: number;
  pending_vendor_approvals: number;
  total_tasks: number;
  total_guests: number;
  total_budget_items: number;
  total_clients: number;
  open_link_requests: number;
}

interface AdminUserRow {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  full_name: string | null;
  role: AppRole;
  company_name: string | null;
  wedding_date: string | null;
}

interface AdminVendorRow {
  listing_id: string;
  user_id: string | null;
  business_name: string;
  category: string;
  location: string | null;
  is_approved: boolean;
  is_verified: boolean;
  verification_requested: boolean;
  verification_requested_at: string | null;
  subscription_status: "inactive" | "active" | "past_due" | "cancelled";
  subscription_expires_at: string | null;
  updated_at: string;
  owner_name: string | null;
  owner_email: string | null;
  profile_kind: "claimed" | "curated" | "featured";
  public_listing_note: string | null;
  featured_rank: number;
  claim_contact_email: string | null;
  claim_invited_at: string | null;
  claim_expires_at: string | null;
}

interface AdminPlannerRow {
  profile_id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  company_email: string | null;
  planner_type: "professional" | "committee";
  committee_name: string | null;
  planner_verified: boolean;
  planner_verification_requested: boolean;
  planner_verification_requested_at: string | null;
  planner_subscription_status: "inactive" | "active" | "past_due" | "cancelled";
  planner_subscription_expires_at: string | null;
  updated_at: string;
  founding_planner_contributor: boolean;
}

interface AdminVendorSuggestionRow {
  suggestion_id: string;
  vendor_name: string;
  category: string;
  instagram_or_website: string | null;
  location: string | null;
  recommendation_reason: string;
  status: "pending" | "reviewed" | "converted" | "rejected";
  created_at: string;
  suggester_role: string | null;
  suggester_name: string | null;
  suggester_email: string | null;
}

interface AdminCouplePassRow {
  profile_id: string;
  user_id: string;
  full_name: string | null;
  wedding_location: string | null;
  wedding_date: string | null;
  planning_pass_status: "inactive" | "active" | "past_due" | "cancelled";
  planning_pass_expires_at: string | null;
  updated_at: string;
  email: string | null;
}

interface AdminFreeTierRiskSummary {
  flagged_accounts: number;
  high_risk_accounts: number;
  medium_risk_accounts: number;
  pending_reviews: number;
  restricted_reviews: number;
  deleted_weddings: number;
}

interface AdminFreeTierRiskAccountRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  account_purpose: string | null;
  verified_couple: boolean;
  professional_use_risk_score: number;
  professional_use_risk_level: "low" | "medium" | "high";
  last_risk_calculated_at: string | null;
  support_review_status: "none" | "pending" | "approved" | "restricted";
  support_review_notes: string | null;
  lifetime_wedding_count: number;
  active_wedding_count: number;
  deleted_wedding_count: number;
  archived_wedding_count: number;
  device_count: number;
  current_trusted_device_count: number;
  device_switches_last_90_days: number;
  otp_requests_last_30_days: number;
  otp_failures_last_30_days: number;
  collaborator_invite_attempts: number;
  export_count: number;
  last_wedding_created_at: string | null;
  last_deleted_wedding_at: string | null;
}

interface AdminWeddingLifecycleRow {
  wedding_id: string;
  created_at: string;
  deleted_at: string | null;
  archived_at: string | null;
  restored_at: string | null;
  wedding_date: string | null;
  status: string;
  is_meaningful: boolean;
  became_meaningful_at: string | null;
  workspace_lifetime_days: number | null;
  guest_count_at_deletion: number | null;
  vendor_count_at_deletion: number | null;
  export_count: number | null;
  collaborator_invite_count: number | null;
  created_wedding_name: string | null;
  deletion_reason: string | null;
}

interface AdminRiskEventRow {
  id: string;
  created_at: string;
  wedding_id: string | null;
  device_session_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
}

interface AdminBetaReadinessSnapshot {
  active_beta_trials: number;
  active_couple_passes: number;
  active_planner_subscriptions: number;
  active_vendor_subscriptions: number;
  active_wedding_entitlements: number;
  active_professional_entitlements: number;
  recent_failed_syncs: number;
  recent_ai_failures: number;
}

interface AdminFunctionEventRow {
  created_at: string;
  function_name: string;
  severity: "info" | "warn" | "error";
  status: "success" | "failure";
  event_type: string;
  message: string;
  user_id: string | null;
  audience: string | null;
  entity_id: string | null;
  request_id: string | null;
  details: Record<string, unknown> | null;
}

type UserRoleFilter = "all" | AppRole;
type VendorStatusFilter = "all" | "pending" | "approved" | "claimed" | "curated" | "featured";
type PlannerVerificationFilter = "all" | "pending" | "verified" | "requested" | "founding";
type PlanningPassFilter = "all" | "inactive" | "active" | "past_due" | "cancelled";
type ReputationIssueFilter = "all" | "flagged" | "clean";
type ReputationVisibilityFilter = "all" | "private" | "planner_network" | "admin_only";
type AiAudience = "couple" | "committee" | "planner" | "vendor";
type AiAudienceFilter = "all" | AiAudience;
type VendorSuggestionFilter = "all" | "pending" | "reviewed" | "converted" | "rejected";
type FreeTierRiskLevelFilter = "all" | "low" | "medium" | "high";
type FreeTierReviewFilter = "all" | "none" | "pending" | "approved" | "restricted";

interface AdminReputationMetrics {
  total_reviews: number;
  flagged_reviews: number;
  planner_network_reviews: number;
  admin_only_reviews: number;
  private_reviews: number;
}

interface AdminReputationRow {
  review_id: string;
  created_at: string;
  vendor_listing_id: string | null;
  vendor_name: string;
  vendor_category: string;
  reviewer_user_id: string;
  reviewer_name: string | null;
  reviewer_email: string | null;
  client_name: string | null;
  overall_rating: number;
  delivered_on_time: boolean | null;
  would_hire_again: boolean;
  issue_flags: string[];
  visibility: ReputationVisibilityFilter;
  review_source: string;
  review_source_role: string | null;
  private_notes: string | null;
}

interface AdminAiUsageMetrics {
  total_messages: number;
  active_users: number;
  couple_messages: number;
  committee_messages: number;
  planner_messages: number;
  vendor_messages: number;
}

interface AdminAiUsageRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  audience: AiAudience;
  role: string;
  month_start: string;
  messages_used: number;
  monthly_message_cap: number;
  remaining_messages: number;
  ai_enabled: boolean;
}

interface AdminAiPlanConfigRow {
  audience: AiAudience;
  monthly_message_cap: number;
  ai_enabled: boolean;
  add_on_separate: boolean;
  add_on_lookup_key: string | null;
  add_on_annual_lookup_key: string | null;
  updated_at: string;
}

interface AdminEstimatorSeedRow {
  id: string;
  created_at: string;
  vendor_name_snapshot: string;
  category: string;
  amount: number;
  price_type: "quote" | "booked" | "final_paid";
  location_county: string | null;
  guest_count: number | null;
  wedding_style: string | null;
  notes: string | null;
}

interface AdminPricingCatalogRow {
  catalog_key: string;
  display_name: string;
  is_active: boolean;
  config: Json;
  updated_at: string;
}

interface AdminPricingRevisionRow {
  id: string;
  catalog_key: string;
  display_name: string;
  config: Json;
  change_source: string;
  created_by_user_id: string | null;
  created_at: string;
}

type AdminPricingPlanCard = {
  title?: string;
  tagline?: string;
  supportCopy?: string;
  monthlyPriceKes?: number | null;
  annualPriceKes?: number | null;
  ctaLabel?: string;
  checkoutMonthlyLookupKey?: string | null;
  checkoutAnnualLookupKey?: string | null;
  includedFeatures?: string[];
};

type AdminPricingAddonCard = {
  title?: string;
  supportCopy?: string;
  checkoutMonthlyLookupKey?: string | null;
  checkoutAnnualLookupKey?: string | null;
  seatLimit?: number | null;
};

type AdminAudiencePricingCard = {
  title?: string;
  subtitle?: string;
  pricingModel?: string;
  freeTierName?: string;
  paidTierName?: string;
  displayOneTimePriceKes?: number | null;
  displayMonthlyPriceKes?: number | null;
  displayAnnualPriceKes?: number | null;
  checkoutOneTimeLookupKey?: string | null;
  checkoutMonthlyLookupKey?: string | null;
  checkoutAnnualLookupKey?: string | null;
};

interface AdminPricingCatalogConfig {
  couplePlans?: Record<string, AdminPricingPlanCard>;
  coupleAddons?: Record<string, AdminPricingAddonCard>;
  professionalPlans?: Record<string, Record<string, AdminPricingPlanCard>>;
  audiencePlans?: Record<string, AdminAudiencePricingCard>;
  checkout?: {
    allowedLookupKeys?: string[];
    coupleCheckoutMap?: Record<string, unknown>;
    professionalCheckoutMap?: Record<string, unknown>;
  };
}

type EstimatorPriceType = "quote" | "booked" | "final_paid";
type EstimatorWeddingStyle = "intimate" | "classic" | "garden" | "luxury";

const roleOptions: AppRole[] = ["couple", "planner", "vendor", "admin"];
const estimatorCategories = ["Venue", "Catering", "Photography", "Videography", "Flowers", "Music/DJ", "Décor", "Transport", "MC", "Cake", "Other"] as const;
const estimatorPriceTypes: EstimatorPriceType[] = ["quote", "booked", "final_paid"];
const estimatorWeddingStyles: EstimatorWeddingStyle[] = ["intimate", "classic", "garden", "luxury"];

const pricingAudienceCards = [
  { key: "couple", label: "Couples" },
  { key: "committee", label: "Committees" },
  { key: "planner", label: "Planners" },
  { key: "vendor", label: "Vendors" },
] as const;

const pricingCouplePlanCards = [
  { key: "free", label: "Couple Intimate" },
  { key: "collaborative", label: "Couple Collaborative" },
] as const;

const pricingProfessionalPlanCards = [
  { audience: "planner", tier: "free", label: "Planner Free" },
  { audience: "planner", tier: "premium", label: "Planner Professional" },
  { audience: "vendor", tier: "free", label: "Vendor Free" },
  { audience: "vendor", tier: "premium", label: "Vendor Professional" },
] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asAdminPricingCatalogConfig(value: Json): AdminPricingCatalogConfig {
  if (!isObjectRecord(value)) return {};

  const normalizeLookupFields = (input: Record<string, unknown>) => {
    const next = { ...input };
    next.checkoutOneTimeLookupKey = getTrimmedOrNull(
      (next.checkoutOneTimeLookupKey as string | undefined) ?? (next.stripeOneTimeLookupKey as string | undefined),
    );
    next.checkoutMonthlyLookupKey = getTrimmedOrNull(
      (next.checkoutMonthlyLookupKey as string | undefined) ?? (next.stripeMonthlyLookupKey as string | undefined),
    );
    next.checkoutAnnualLookupKey = getTrimmedOrNull(
      (next.checkoutAnnualLookupKey as string | undefined) ?? (next.stripeAnnualLookupKey as string | undefined),
    );
    delete next.stripeOneTimeLookupKey;
    delete next.stripeMonthlyLookupKey;
    delete next.stripeAnnualLookupKey;
    return next;
  };

  const next = { ...value } as Record<string, unknown>;

  if (isObjectRecord(next.audiencePlans)) {
    next.audiencePlans = Object.fromEntries(
      Object.entries(next.audiencePlans).map(([key, plan]) => [
        key,
        isObjectRecord(plan) ? normalizeLookupFields(plan) : plan,
      ]),
    );
  }

  if (isObjectRecord(next.couplePlans)) {
    next.couplePlans = Object.fromEntries(
      Object.entries(next.couplePlans).map(([key, plan]) => [
        key,
        isObjectRecord(plan) ? normalizeLookupFields(plan) : plan,
      ]),
    );
  }

  if (isObjectRecord(next.coupleAddons)) {
    next.coupleAddons = Object.fromEntries(
      Object.entries(next.coupleAddons).map(([key, addon]) => [
        key,
        isObjectRecord(addon) ? normalizeLookupFields(addon) : addon,
      ]),
    );
  }

  if (isObjectRecord(next.professionalPlans)) {
    next.professionalPlans = Object.fromEntries(
      Object.entries(next.professionalPlans).map(([audience, plans]) => [
        audience,
        isObjectRecord(plans)
          ? Object.fromEntries(
              Object.entries(plans).map(([tier, plan]) => [
                tier,
                isObjectRecord(plan) ? normalizeLookupFields(plan) : plan,
              ]),
            )
          : plans,
      ]),
    );
  }

  delete next.professionalAddons;
  return next as unknown as AdminPricingCatalogConfig;
}

function getTrimmedOrNull(value: string | undefined) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : null;
}

function getNumberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function deriveAllowedLookupKeys(config: AdminPricingCatalogConfig) {
  const keys = new Set<string>();
  const collect = (value?: string | null) => {
    if (typeof value === "string" && value.trim()) keys.add(value.trim());
  };

  Object.values(config.audiencePlans ?? {}).forEach((plan) => {
    collect(plan.checkoutOneTimeLookupKey);
    collect(plan.checkoutMonthlyLookupKey);
    collect(plan.checkoutAnnualLookupKey);
  });

  Object.values(config.couplePlans ?? {}).forEach((plan) => {
    collect(plan.checkoutMonthlyLookupKey);
    collect(plan.checkoutAnnualLookupKey);
  });

  Object.values(config.professionalPlans ?? {}).forEach((tiers) => {
    Object.values(tiers ?? {}).forEach((plan) => {
      collect(plan.checkoutMonthlyLookupKey);
      collect(plan.checkoutAnnualLookupKey);
    });
  });

  return Array.from(keys);
}

function normalizePricingCatalogConfig(config: AdminPricingCatalogConfig): AdminPricingCatalogConfig {
  const next: AdminPricingCatalogConfig = {
    ...config,
    checkout: {
      ...(config.checkout ?? {}),
      allowedLookupKeys: deriveAllowedLookupKeys(config),
      coupleCheckoutMap: {},
      professionalCheckoutMap: {},
    },
  };

  const couplePlans = [
    { key: next.couplePlans?.collaborative?.checkoutMonthlyLookupKey, bundleCode: "couple_collaborative_monthly", cadence: "monthly" },
    { key: next.couplePlans?.collaborative?.checkoutAnnualLookupKey, bundleCode: "couple_collaborative_annual", cadence: "annual" },
  ] as const;

  couplePlans.forEach((plan) => {
    const lookupKey = plan.key?.trim();
    if (!lookupKey) return;
    next.checkout!.coupleCheckoutMap![lookupKey] = {
      bundleCode: plan.bundleCode,
      bundleType: "wedding_pass",
      features: ["wedding_collaboration", "planner_collaboration", "vendor_collaboration"],
      couplePlanTier: "collaborative",
      seatLimits: null,
      syncLegacyPlanningPass: false,
    };
  });

  const professionalPlans = [
    next.professionalPlans?.planner?.premium?.checkoutMonthlyLookupKey,
    next.professionalPlans?.planner?.premium?.checkoutAnnualLookupKey,
    next.professionalPlans?.vendor?.premium?.checkoutMonthlyLookupKey,
    next.professionalPlans?.vendor?.premium?.checkoutAnnualLookupKey,
  ];

  professionalPlans.forEach((key) => {
    const lookupKey = key?.trim();
    if (!lookupKey) return;
    next.checkout!.professionalCheckoutMap![lookupKey] = {
      features: ["booking_management", "invoicing", "contract_management", "media_portfolio"],
    };
  });

  return next;
}

function countLabel(value?: number) {
  return Number(value ?? 0).toLocaleString();
}

function formatAccountPurposeLabel(value: string | null | undefined) {
  if (!value) return "purpose not set";
  return value.replace(/_/g, " ");
}

function formatRiskEventType(eventType: string) {
  return eventType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeRiskEvent(event: AdminRiskEventRow) {
  const metadata = event.metadata ?? {};

  switch (event.event_type) {
    case "EXPORT_GENERATED":
      return "User exported planning data from a workspace.";
    case "DEVICE_SWITCHED":
      return "User switched to a different device session.";
    case "COLLABORATOR_INVITE_ATTEMPTED":
      return "User attempted to add collaborators on a free-tier workspace.";
    case "PLANNER_ROLE_ATTEMPTED":
      return "User attempted to access planner-only capabilities.";
    case "SECOND_WEDDING_ATTEMPTED":
      return "User tried to create or retain an extra wedding workspace.";
    case "COLLABORATIVE_PLAN_REQUIRED":
      return "Feature access was blocked because the current plan does not allow collaboration.";
    case "SUPPORT_REVIEW_UPDATED":
      return `Support review set to ${String(metadata.support_review_status ?? "updated")}.`;
    case "AUTOMATED_REVIEW_QUEUED":
      return `Automatically queued for review at risk score ${String(metadata.risk_score ?? "unknown")}.`;
    default:
      return "Account activity recorded for review.";
  }
}

function formatRiskEventMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3);

  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(" · ");
}

function buildRiskSignals(account: AdminFreeTierRiskAccountRow | null) {
  if (!account) return [];

  const signals: string[] = [];

  if (account.account_purpose === "professional_planner") {
    signals.push("Account purpose explicitly set to professional planner");
  }
  if (account.lifetime_wedding_count > 2) {
    signals.push(`${account.lifetime_wedding_count} total wedding workspaces created`);
  }
  if (account.deleted_wedding_count > 0 && account.active_wedding_count > 0) {
    signals.push("Deleted workspaces while keeping an active workspace");
  }
  if (account.export_count >= 3) {
    signals.push(`${account.export_count} exports recorded across workspaces`);
  }
  if (account.device_switches_last_90_days > 3) {
    signals.push(`${account.device_switches_last_90_days} device switches in the last 90 days`);
  }
  if (account.collaborator_invite_attempts > 0) {
    signals.push(`${account.collaborator_invite_attempts} collaborator or planner access attempts`);
  }
  if (account.otp_failures_last_30_days >= 3) {
    signals.push(`${account.otp_failures_last_30_days} OTP failures in the last 30 days`);
  }
  if (account.deleted_wedding_count > 1) {
    signals.push(`${account.deleted_wedding_count} deleted wedding workspaces on record`);
  }

  return signals;
}

export default function AdminPortal() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [planners, setPlanners] = useState<AdminPlannerRow[]>([]);
  const [vendorSuggestions, setVendorSuggestions] = useState<AdminVendorSuggestionRow[]>([]);
  const [couples, setCouples] = useState<AdminCouplePassRow[]>([]);
  const [freeTierRiskSummary, setFreeTierRiskSummary] = useState<AdminFreeTierRiskSummary | null>(null);
  const [freeTierRiskAccounts, setFreeTierRiskAccounts] = useState<AdminFreeTierRiskAccountRow[]>([]);
  const [selectedRiskUserId, setSelectedRiskUserId] = useState<string | null>(null);
  const [selectedRiskLifecycle, setSelectedRiskLifecycle] = useState<AdminWeddingLifecycleRow[]>([]);
  const [selectedRiskEvents, setSelectedRiskEvents] = useState<AdminRiskEventRow[]>([]);
  const [betaSnapshot, setBetaSnapshot] = useState<AdminBetaReadinessSnapshot | null>(null);
  const [functionEvents, setFunctionEvents] = useState<AdminFunctionEventRow[]>([]);
  const [reputationMetrics, setReputationMetrics] = useState<AdminReputationMetrics | null>(null);
  const [reputationReviews, setReputationReviews] = useState<AdminReputationRow[]>([]);
  const [aiUsageMetrics, setAiUsageMetrics] = useState<AdminAiUsageMetrics | null>(null);
  const [aiUsageRows, setAiUsageRows] = useState<AdminAiUsageRow[]>([]);
  const [aiPlanConfigs, setAiPlanConfigs] = useState<AdminAiPlanConfigRow[]>([]);
  const [pricingCatalog, setPricingCatalog] = useState<AdminPricingCatalogRow | null>(null);
  const [pricingHistory, setPricingHistory] = useState<AdminPricingRevisionRow[]>([]);
  const [pricingCatalogDraft, setPricingCatalogDraft] = useState<AdminPricingCatalogConfig | null>(null);
  const [pricingDisplayNameDraft, setPricingDisplayNameDraft] = useState("");
  const [loadingPricingCatalog, setLoadingPricingCatalog] = useState(false);
  const [loadingPricingHistory, setLoadingPricingHistory] = useState(false);
  const [savingPricingCatalog, setSavingPricingCatalog] = useState(false);
  const [restoringPricingRevisionId, setRestoringPricingRevisionId] = useState<string | null>(null);
  const [estimatorSeeds, setEstimatorSeeds] = useState<AdminEstimatorSeedRow[]>([]);
  const [savingEstimatorSeed, setSavingEstimatorSeed] = useState(false);
  const [loadingEstimatorSeeds, setLoadingEstimatorSeeds] = useState(false);
  const [estimatorSeedForm, setEstimatorSeedForm] = useState({
    vendorName: "Beta market backfill",
    category: "Venue",
    amount: "",
    priceType: "quote" as EstimatorPriceType,
    county: "Nairobi",
    guestCount: "",
    weddingStyle: "classic" as EstimatorWeddingStyle,
    notes: "",
  });
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, AdminVendorRow["subscription_status"]>>({});
  const [subscriptionExpiryDrafts, setSubscriptionExpiryDrafts] = useState<Record<string, string>>({});
  const [plannerSubscriptionDrafts, setPlannerSubscriptionDrafts] = useState<Record<string, AdminPlannerRow["planner_subscription_status"]>>({});
  const [plannerSubscriptionExpiryDrafts, setPlannerSubscriptionExpiryDrafts] = useState<Record<string, string>>({});
  const [plannerVerificationDrafts, setPlannerVerificationDrafts] = useState<Record<string, boolean>>({});
  const [plannerFoundingDrafts, setPlannerFoundingDrafts] = useState<Record<string, boolean>>({});
  const [planningPassDrafts, setPlanningPassDrafts] = useState<Record<string, AdminCouplePassRow["planning_pass_status"]>>({});
  const [vendorProfileKindDrafts, setVendorProfileKindDrafts] = useState<Record<string, AdminVendorRow["profile_kind"]>>({});
  const [vendorProfileNoteDrafts, setVendorProfileNoteDrafts] = useState<Record<string, string>>({});
  const [vendorFeaturedRankDrafts, setVendorFeaturedRankDrafts] = useState<Record<string, string>>({});
  const [vendorClaimEmailDrafts, setVendorClaimEmailDrafts] = useState<Record<string, string>>({});
  const [vendorClaimLinkDrafts, setVendorClaimLinkDrafts] = useState<Record<string, string>>({});
  const [planningPassExpiryDrafts, setPlanningPassExpiryDrafts] = useState<Record<string, string>>({});
  const [riskReviewStatusDrafts, setRiskReviewStatusDrafts] = useState<Record<string, FreeTierReviewFilter>>({});
  const [riskReviewNotesDrafts, setRiskReviewNotesDrafts] = useState<Record<string, string>>({});
  const [riskVerifiedCoupleDrafts, setRiskVerifiedCoupleDrafts] = useState<Record<string, boolean>>({});
  const [reviewVisibilityDrafts, setReviewVisibilityDrafts] = useState<Record<string, ReputationVisibilityFilter>>({});
  const [aiCapDrafts, setAiCapDrafts] = useState<Record<string, string>>({});
  const [aiEnabledDrafts, setAiEnabledDrafts] = useState<Record<string, boolean>>({});
  const [aiAddonSeparateDrafts, setAiAddonSeparateDrafts] = useState<Record<string, boolean>>({});
  const [aiAddonLookupDrafts, setAiAddonLookupDrafts] = useState<Record<string, string>>({});
  const [aiAddonAnnualLookupDrafts, setAiAddonAnnualLookupDrafts] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingVendorId, setSavingVendorId] = useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [savingAiAudience, setSavingAiAudience] = useState<string | null>(null);
  const [savingRiskUserId, setSavingRiskUserId] = useState<string | null>(null);
  const [restoringRiskWeddingId, setRestoringRiskWeddingId] = useState<string | null>(null);
  const [resettingRiskDeviceUserId, setResettingRiskDeviceUserId] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<VendorStatusFilter>("pending");
  const [vendorSuggestionSearch, setVendorSuggestionSearch] = useState("");
  const [vendorSuggestionFilter, setVendorSuggestionFilter] = useState<VendorSuggestionFilter>("pending");
  const [plannerSearch, setPlannerSearch] = useState("");
  const [plannerVerificationFilter, setPlannerVerificationFilter] = useState<PlannerVerificationFilter>("all");
  const [coupleSearch, setCoupleSearch] = useState("");
  const [planningPassFilter, setPlanningPassFilter] = useState<PlanningPassFilter>("all");
  const [freeTierRiskSearch, setFreeTierRiskSearch] = useState("");
  const [freeTierRiskLevelFilter, setFreeTierRiskLevelFilter] = useState<FreeTierRiskLevelFilter>("all");
  const [freeTierReviewFilter, setFreeTierReviewFilter] = useState<FreeTierReviewFilter>("all");
  const [reputationSearch, setReputationSearch] = useState("");
  const [reputationIssueFilter, setReputationIssueFilter] = useState<ReputationIssueFilter>("flagged");
  const [reputationVisibilityFilter, setReputationVisibilityFilter] = useState<ReputationVisibilityFilter>("all");
  const [aiUsageSearch, setAiUsageSearch] = useState("");
  const [aiAudienceFilter, setAiAudienceFilter] = useState<AiAudienceFilter>("all");

  const loadMetrics = async () => {
    const { data, error } = await supabase.rpc("admin_dashboard_metrics" as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setMetrics((row ?? null) as unknown as AdminDashboardMetrics | null);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase.rpc("admin_list_users" as any, {
      search_query: userSearch.trim() || null,
      role_filter: userRoleFilter === "all" ? null : userRoleFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    const rows = ((data ?? []) as unknown as AdminUserRow[]).map((row) => ({
      ...row,
      role: row.role ?? "couple",
    }));
    setUsers(rows);
    setRoleDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.user_id]) {
          next[row.user_id] = row.role;
        }
      }
      return next;
    });
  };

  const loadVendors = async () => {
    const { data, error } = await supabase.rpc("admin_list_vendor_listings" as any, {
      search_query: vendorSearch.trim() || null,
      status_filter: vendorStatusFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdminVendorRow[];
    setVendors(rows);
    setSubscriptionDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.listing_id] = row.subscription_status;
      }
      return next;
    });
    setSubscriptionExpiryDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        next[row.listing_id] = row.subscription_expires_at ? row.subscription_expires_at.slice(0, 10) : "";
      }
      return next;
    });
    setVendorProfileKindDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.listing_id] = row.profile_kind;
      return next;
    });
    setVendorProfileNoteDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.listing_id] = row.public_listing_note ?? "";
      return next;
    });
    setVendorFeaturedRankDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.listing_id] = String(row.featured_rank ?? 0);
      return next;
    });
    setVendorClaimEmailDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.listing_id] = row.claim_contact_email ?? row.owner_email ?? "";
      return next;
    });
  };

  const loadReputationMetrics = async () => {
    const { data, error } = await supabase.rpc("admin_reputation_review_metrics" as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setReputationMetrics((row ?? null) as unknown as AdminReputationMetrics | null);
  };

  const loadPlanners = async () => {
    const { data, error } = await supabase.rpc("admin_list_planner_profiles" as any, {
      search_query: plannerSearch.trim() || null,
      verification_filter: plannerVerificationFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdminPlannerRow[];
    setPlanners(rows);
    setPlannerSubscriptionDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.planner_subscription_status;
      return next;
    });
    setPlannerSubscriptionExpiryDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.planner_subscription_expires_at ? row.planner_subscription_expires_at.slice(0, 10) : "";
      return next;
    });
    setPlannerVerificationDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.planner_verified;
      return next;
    });
    setPlannerFoundingDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.founding_planner_contributor;
      return next;
    });
  };

  const loadVendorSuggestions = async () => {
    const { data, error } = await supabase.rpc("admin_list_vendor_suggestions" as any, {
      search_query: vendorSuggestionSearch.trim() || null,
      status_filter: vendorSuggestionFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    setVendorSuggestions((data ?? []) as unknown as AdminVendorSuggestionRow[]);
  };

  const loadReputationReviews = async () => {
    const { data, error } = await supabase.rpc("admin_list_vendor_reputation_reviews" as any, {
      search_query: reputationSearch.trim() || null,
      issue_filter: reputationIssueFilter,
      visibility_filter: reputationVisibilityFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;

    const rows = ((data ?? []) as unknown as AdminReputationRow[]).map((row) => ({
      ...row,
      issue_flags: row.issue_flags ?? [],
    }));
    setReputationReviews(rows);
    setReviewVisibilityDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.review_id]) next[row.review_id] = row.visibility;
      }
      return next;
    });
  };

  const loadCouples = async () => {
    const { data, error } = await supabase.rpc("admin_list_couple_planning_passes" as any, {
      search_query: coupleSearch.trim() || null,
      status_filter: planningPassFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdminCouplePassRow[];
    setCouples(rows);
    setPlanningPassDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.planning_pass_status;
      return next;
    });
    setPlanningPassExpiryDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.planning_pass_expires_at ? row.planning_pass_expires_at.slice(0, 10) : "";
      return next;
    });
  };

  const loadFreeTierRiskSummary = async () => {
    const { data, error } = await supabase.rpc("admin_free_tier_risk_summary" as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setFreeTierRiskSummary((row ?? null) as unknown as AdminFreeTierRiskSummary | null);
  };

  const loadFreeTierRiskAccounts = async () => {
    const { data, error } = await supabase.rpc("admin_list_free_tier_risk_accounts" as any, {
      search_query: freeTierRiskSearch.trim() || null,
      risk_level_filter: freeTierRiskLevelFilter,
      review_status_filter: freeTierReviewFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;

    const rows = (data ?? []) as unknown as AdminFreeTierRiskAccountRow[];
    setFreeTierRiskAccounts(rows);
    setRiskReviewStatusDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.support_review_status;
      return next;
    });
    setRiskReviewNotesDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!(row.user_id in next)) next[row.user_id] = row.support_review_notes ?? "";
      }
      return next;
    });
    setRiskVerifiedCoupleDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.user_id] = row.verified_couple;
      return next;
    });
    setSelectedRiskUserId((current) => current ?? rows[0]?.user_id ?? null);
  };

  const loadSelectedRiskDetails = async (targetUserId: string) => {
    const [{ data: lifecycleData, error: lifecycleError }, { data: eventsData, error: eventsError }] = await Promise.all([
      supabase.rpc("admin_list_user_wedding_lifecycle" as any, {
        target_user_id: targetUserId,
      }),
      supabase.rpc("admin_list_user_account_audit_events" as any, {
        target_user_id: targetUserId,
        limit_rows: 30,
      }),
    ]);

    if (lifecycleError) throw lifecycleError;
    if (eventsError) throw eventsError;

    setSelectedRiskLifecycle((lifecycleData ?? []) as unknown as AdminWeddingLifecycleRow[]);
    setSelectedRiskEvents((eventsData ?? []) as unknown as AdminRiskEventRow[]);
  };

  const loadBetaSnapshot = async () => {
    const { data, error } = await supabase.rpc("admin_beta_readiness_snapshot" as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setBetaSnapshot((row ?? null) as unknown as AdminBetaReadinessSnapshot | null);
  };

  const loadFunctionEvents = async () => {
    const { data, error } = await supabase.rpc("admin_recent_function_events" as any, {
      status_filter: "failure",
      limit_rows: 50,
    });
    if (error) throw error;
    setFunctionEvents((data ?? []) as unknown as AdminFunctionEventRow[]);
  };

  const loadAiUsageMetrics = async () => {
    const { data, error } = await supabase.rpc("admin_ai_usage_metrics" as any);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setAiUsageMetrics((row ?? null) as unknown as AdminAiUsageMetrics | null);
  };

  const loadAiUsageRows = async () => {
    const { data, error } = await supabase.rpc("admin_list_ai_usage" as any, {
      search_query: aiUsageSearch.trim() || null,
      audience_filter: aiAudienceFilter,
      limit_rows: 100,
      offset_rows: 0,
    });
    if (error) throw error;
    setAiUsageRows((data ?? []) as unknown as AdminAiUsageRow[]);
  };

  const loadAiPlanConfigs = async () => {
    const { data, error } = await supabase.rpc("admin_list_ai_plan_configs" as any);
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdminAiPlanConfigRow[];
    setAiPlanConfigs(rows);
    setAiCapDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.audience] = String(row.monthly_message_cap ?? 0);
      return next;
    });
    setAiEnabledDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.audience] = row.ai_enabled;
      return next;
    });
    setAiAddonSeparateDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.audience] = row.add_on_separate;
      return next;
    });
    setAiAddonLookupDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.audience] = row.add_on_lookup_key ?? "";
      return next;
    });
    setAiAddonAnnualLookupDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) next[row.audience] = row.add_on_annual_lookup_key ?? "";
      return next;
    });
  };

  const loadPricingCatalog = async () => {
    setLoadingPricingCatalog(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_active_pricing_catalog" as any);
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as AdminPricingCatalogRow | null;
      setPricingCatalog(row);
      const nextConfig = asAdminPricingCatalogConfig((row?.config ?? {}) as Json);
      setPricingCatalogDraft(nextConfig);
      setPricingDisplayNameDraft(row?.display_name ?? "Default Live Pricing Catalog");
    } finally {
      setLoadingPricingCatalog(false);
    }
  };

  const loadPricingHistory = async () => {
    setLoadingPricingHistory(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_pricing_catalog_revisions" as any, {
        limit_rows: 12,
      });
      if (error) throw error;
      setPricingHistory(((data ?? []) as unknown as AdminPricingRevisionRow[]) ?? []);
    } finally {
      setLoadingPricingHistory(false);
    }
  };

  const loadEstimatorSeeds = async () => {
    setLoadingEstimatorSeeds(true);
    try {
      const { data, error } = await supabase
        .from("vendor_price_observations")
        .select("id, created_at, vendor_name_snapshot, category, amount, price_type, location_county, guest_count, wedding_style, notes")
        .eq("source", "admin_backfill")
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      setEstimatorSeeds((data ?? []) as unknown as AdminEstimatorSeedRow[]);
    } finally {
      setLoadingEstimatorSeeds(false);
    }
  };

  const loadAll = async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    else setRefreshing(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadUsers(),
        loadVendors(),
        loadVendorSuggestions(),
        loadPlanners(),
        loadCouples(),
        loadFreeTierRiskSummary(),
        loadFreeTierRiskAccounts(),
        loadBetaSnapshot(),
        loadFunctionEvents(),
        loadReputationMetrics(),
        loadReputationReviews(),
        loadAiUsageMetrics(),
        loadAiUsageRows(),
        loadAiPlanConfigs(),
        loadPricingCatalog(),
        loadPricingHistory(),
        loadEstimatorSeeds(),
      ]);
    } catch (error: any) {
      toast({
        title: "Failed to load admin portal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAll(true);
  }, []);

  useEffect(() => {
    if (!selectedRiskUserId) {
      setSelectedRiskLifecycle([]);
      setSelectedRiskEvents([]);
      return;
    }

    void loadSelectedRiskDetails(selectedRiskUserId).catch((error: any) => {
      toast({
        title: "Failed to load account risk details",
        description: error.message,
        variant: "destructive",
      });
    });
  }, [selectedRiskUserId]);

  const applyUserFilters = async () => {
    try {
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Failed to load users",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyVendorFilters = async () => {
    try {
      await loadVendors();
    } catch (error: any) {
      toast({
        title: "Failed to load vendors",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyPlannerFilters = async () => {
    try {
      await loadPlanners();
    } catch (error: any) {
      toast({
        title: "Failed to load planners",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyCoupleFilters = async () => {
    try {
      await loadCouples();
    } catch (error: any) {
      toast({
        title: "Failed to load Wedding Plan records",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyFreeTierRiskFilters = async () => {
    try {
      await Promise.all([loadFreeTierRiskSummary(), loadFreeTierRiskAccounts()]);
    } catch (error: any) {
      toast({
        title: "Failed to load free-tier risk queue",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyReputationFilters = async () => {
    try {
      await loadReputationReviews();
    } catch (error: any) {
      toast({
        title: "Failed to load reputation reviews",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyAiUsageFilters = async () => {
    try {
      await loadAiUsageRows();
    } catch (error: any) {
      toast({
        title: "Failed to load AI usage",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const healthSummary = useMemo(() => {
    const missingNames = users.filter((item) => !item.full_name?.trim() && !item.company_name?.trim()).length;
    const pendingVendorCount = vendors.filter((item) => !item.is_approved).length;
    const noLocationCount = vendors.filter((item) => !item.location?.trim()).length;
    const flaggedReviews = reputationMetrics?.flagged_reviews ?? 0;

    return { missingNames, pendingVendorCount, noLocationCount, flaggedReviews };
  }, [users, vendors, reputationMetrics]);

  const selectedRiskAccount = useMemo(
    () => freeTierRiskAccounts.find((item) => item.user_id === selectedRiskUserId) ?? null,
    [freeTierRiskAccounts, selectedRiskUserId],
  );

  const selectedRiskSignals = useMemo(
    () => buildRiskSignals(selectedRiskAccount),
    [selectedRiskAccount],
  );

  const updateAudiencePricingDraft = (
    audienceKey: string,
    field: keyof AdminAudiencePricingCard,
    value: string | number | null,
  ) => {
    setPricingCatalogDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        audiencePlans: {
          ...(current.audiencePlans ?? {}),
          [audienceKey]: {
            ...(current.audiencePlans?.[audienceKey] ?? {}),
            [field]: value,
          },
        },
      };
    });
  };

  const updateCouplePlanDraft = (
    tierKey: string,
    field: keyof AdminPricingPlanCard,
    value: string | number | null | string[],
  ) => {
    setPricingCatalogDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        couplePlans: {
          ...(current.couplePlans ?? {}),
          [tierKey]: {
            ...(current.couplePlans?.[tierKey] ?? {}),
            [field]: value,
          },
        },
      };
    });
  };

  const updateProfessionalPlanDraft = (
    audienceKey: string,
    tierKey: string,
    field: keyof AdminPricingPlanCard,
    value: string | number | null | string[],
  ) => {
    setPricingCatalogDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        professionalPlans: {
          ...(current.professionalPlans ?? {}),
          [audienceKey]: {
            ...(current.professionalPlans?.[audienceKey] ?? {}),
            [tierKey]: {
              ...(current.professionalPlans?.[audienceKey]?.[tierKey] ?? {}),
              [field]: value,
            },
          },
        },
      };
    });
  };

  const handleRoleUpdate = async (targetUserId: string) => {
    const target = users.find((item) => item.user_id === targetUserId);
    const nextRole = roleDrafts[targetUserId];
    if (!target || !nextRole || target.role === nextRole) return;

    if (targetUserId === user?.id && nextRole !== "admin") {
      toast({
        title: "Blocked",
        description: "Keep your own account as admin to avoid lockout.",
        variant: "destructive",
      });
      return;
    }

    setSavingUserId(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_user_role" as any, {
        target_user_id: targetUserId,
        new_role: nextRole,
      });
      if (error) throw error;

      toast({
        title: "Role updated",
        description: `${target.full_name || target.email || "User"} is now ${nextRole}.`,
      });

      await Promise.all([loadUsers(), loadMetrics()]);
    } catch (error: any) {
      toast({
        title: "Role update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleVendorReview = async (listingId: string, approve: boolean, verify: boolean) => {
    setSavingVendorId(listingId);
    try {
      const { error } = await supabase.rpc("admin_review_vendor_listing" as any, {
        listing_id: listingId,
        approve,
        verify,
      });
      if (error) throw error;

      toast({
        title: "Listing updated",
        description: approve ? "Vendor listing approved." : "Vendor listing moved back to pending.",
      });

      await Promise.all([loadVendors(), loadMetrics()]);
    } catch (error: any) {
      toast({
        title: "Vendor update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleVendorSubscriptionUpdate = async (listingId: string) => {
    const nextStatus = subscriptionDrafts[listingId];
    const nextExpiry = subscriptionExpiryDrafts[listingId]?.trim() || null;
    if (!nextStatus) return;

    setSavingVendorId(listingId);
    try {
      const { error } = await supabase.rpc("admin_set_vendor_subscription" as any, {
        listing_id: listingId,
        new_subscription_status: nextStatus,
        new_subscription_expires_at: nextExpiry ? new Date(`${nextExpiry}T23:59:59Z`).toISOString() : null,
      });
      if (error) throw error;

      toast({
        title: "Subscription updated",
        description: `Vendor subscription is now ${nextStatus}.`,
      });

      await loadVendors();
    } catch (error: any) {
      toast({
        title: "Subscription update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const handlePlannerAccessUpdate = async (targetUserId: string) => {
    const nextStatus = plannerSubscriptionDrafts[targetUserId];
    const nextExpiry = plannerSubscriptionExpiryDrafts[targetUserId]?.trim() || null;
    const nextVerified = plannerVerificationDrafts[targetUserId];
    if (!nextStatus || nextVerified === undefined) return;

    setSavingUserId(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_planner_access" as any, {
        target_user_id: targetUserId,
        new_verified: nextVerified,
        new_subscription_status: nextStatus,
        new_subscription_expires_at: nextExpiry ? new Date(`${nextExpiry}T23:59:59Z`).toISOString() : null,
      });
      if (error) throw error;

      toast({
        title: "Planner access updated",
        description: `Planner access updated to ${nextStatus}${nextVerified ? ' and verified' : ''}.`,
      });

      await loadPlanners();
    } catch (error: any) {
      toast({
        title: "Planner access update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handlePlannerFoundingUpdate = async (targetUserId: string) => {
    const nextFounding = plannerFoundingDrafts[targetUserId];
    if (nextFounding === undefined) return;

    setSavingUserId(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_planner_founding_contributor" as any, {
        target_user_id: targetUserId,
        new_founding_planner_contributor: nextFounding,
      });
      if (error) throw error;

      toast({
        title: "Founding status updated",
        description: `Planner founding contributor status is now ${nextFounding ? "enabled" : "disabled"}.`,
      });

      await loadPlanners();
    } catch (error: any) {
      toast({
        title: "Founding status update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleVendorProfileSave = async (listingId: string) => {
    const nextKind = vendorProfileKindDrafts[listingId];
    const nextNote = vendorProfileNoteDrafts[listingId] ?? "";
    const nextRank = Number(vendorFeaturedRankDrafts[listingId] ?? 0);
    if (!nextKind || !Number.isFinite(nextRank) || nextRank < 0) {
      toast({
        title: "Invalid featured rank",
        description: "Featured rank must be 0 or greater.",
        variant: "destructive",
      });
      return;
    }

    setSavingVendorId(listingId);
    try {
      const { error } = await supabase.rpc("admin_set_vendor_listing_profile" as any, {
        listing_id: listingId,
        new_profile_kind: nextKind,
        new_public_listing_note: nextNote.trim() || null,
        new_featured_rank: nextRank,
      });
      if (error) throw error;

      toast({
        title: "Listing profile updated",
        description: `Vendor profile is now ${nextKind}.`,
      });

      await loadVendors();
    } catch (error: any) {
      toast({
        title: "Vendor profile update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleVendorClaimInvite = async (listingId: string) => {
    const claimEmail = vendorClaimEmailDrafts[listingId]?.trim().toLowerCase() ?? "";
    if (!claimEmail) {
      toast({
        title: "Claim email required",
        description: "Enter the vendor email that should receive this claim invite.",
        variant: "destructive",
      });
      return;
    }

    setSavingVendorId(listingId);
    try {
      const { data, error } = await supabase.rpc("admin_prepare_vendor_listing_claim" as any, {
        listing_id: listingId,
        claim_email: claimEmail,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const claimUrl = row?.claim_url as string | undefined;
      if (claimUrl) {
        setVendorClaimLinkDrafts((prev) => ({
          ...prev,
          [listingId]: claimUrl,
        }));
      }

      toast({
        title: "Claim invite prepared",
        description: "Share the generated claim link with the vendor so they can attach this listing to their account.",
      });

      await loadVendors();
    } catch (error: any) {
      toast({
        title: "Could not prepare claim invite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const applyVendorSuggestionFilters = async () => {
    try {
      await loadVendorSuggestions();
    } catch (error: any) {
      toast({
        title: "Failed to load vendor suggestions",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVendorSuggestionStatus = async (suggestionId: string, newStatus: VendorSuggestionFilter) => {
    if (newStatus === "all") return;
    setSavingVendorId(suggestionId);
    try {
      const { error } = await supabase.rpc("admin_set_vendor_suggestion_status" as any, {
        suggestion_id: suggestionId,
        new_status: newStatus,
      });
      if (error) throw error;

      toast({
        title: "Suggestion updated",
        description: `Suggestion marked ${newStatus}.`,
      });

      await loadVendorSuggestions();
    } catch (error: any) {
      toast({
        title: "Suggestion update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const handleVendorSuggestionConvert = async (suggestionId: string) => {
    setSavingVendorId(suggestionId);
    try {
      const { error } = await supabase.rpc("admin_convert_vendor_suggestion" as any, {
        suggestion_id: suggestionId,
      });
      if (error) throw error;

      toast({
        title: "Suggestion converted",
        description: "A curated vendor listing was created from the suggestion.",
      });

      await Promise.all([loadVendorSuggestions(), loadVendors(), loadMetrics()]);
    } catch (error: any) {
      toast({
        title: "Suggestion conversion failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingVendorId(null);
    }
  };

  const handlePlanningPassUpdate = async (targetUserId: string) => {
    const nextStatus = planningPassDrafts[targetUserId];
    const nextExpiry = planningPassExpiryDrafts[targetUserId]?.trim() || null;
    if (!nextStatus) return;

    setSavingUserId(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_couple_planning_pass" as any, {
        target_user_id: targetUserId,
        new_planning_pass_status: nextStatus,
        new_planning_pass_expires_at: nextExpiry ? new Date(`${nextExpiry}T23:59:59Z`).toISOString() : null,
      });
      if (error) throw error;

      toast({
        title: "Wedding Plan updated",
        description: `Couple Wedding Plan access is now ${nextStatus}.`,
      });

      await loadCouples();
    } catch (error: any) {
      toast({
        title: "Wedding Plan update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const handleFreeTierReviewSave = async (targetUserId: string) => {
    const nextReviewStatus = riskReviewStatusDrafts[targetUserId];
    const nextReviewNotes = riskReviewNotesDrafts[targetUserId] ?? "";
    const nextVerifiedCouple = riskVerifiedCoupleDrafts[targetUserId];

    if (!nextReviewStatus || nextVerifiedCouple === undefined) return;

    setSavingRiskUserId(targetUserId);
    try {
      const { error } = await supabase.rpc("admin_set_free_tier_review_state" as any, {
        target_user_id: targetUserId,
        new_review_status: nextReviewStatus,
        new_review_notes: nextReviewNotes.trim() || null,
        new_verified_couple: nextVerifiedCouple,
      });
      if (error) throw error;

      toast({
        title: "Review state updated",
        description: "The free-tier review status and notes were saved.",
      });

      await Promise.all([
        loadFreeTierRiskSummary(),
        loadFreeTierRiskAccounts(),
        selectedRiskUserId === targetUserId ? loadSelectedRiskDetails(targetUserId) : Promise.resolve(),
      ]);
    } catch (error: any) {
      toast({
        title: "Review update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingRiskUserId(null);
    }
  };

  const handleRestoreDeletedWedding = async (weddingId: string) => {
    setRestoringRiskWeddingId(weddingId);
    try {
      const { error } = await supabase.rpc("admin_restore_deleted_wedding" as any, {
        target_wedding_id: weddingId,
      });
      if (error) throw error;

      toast({
        title: "Wedding restored",
        description: "The deleted wedding workspace was restored into an archived state.",
      });

      await Promise.all([
        loadFreeTierRiskSummary(),
        loadFreeTierRiskAccounts(),
        selectedRiskUserId ? loadSelectedRiskDetails(selectedRiskUserId) : Promise.resolve(),
      ]);
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRestoringRiskWeddingId(null);
    }
  };

  const handleResetRiskDevices = async (targetUserId: string) => {
    setResettingRiskDeviceUserId(targetUserId);
    try {
      const { data, error } = await supabase.rpc("admin_reset_free_tier_device_sessions" as any, {
        target_user_id: targetUserId,
      });
      if (error) throw error;

      toast({
        title: "Trusted devices reset",
        description: `Revoked ${Number(data ?? 0)} active device session${Number(data ?? 0) === 1 ? "" : "s"}. The user can verify a device again on next sign-in.`,
      });

      await Promise.all([
        loadFreeTierRiskSummary(),
        loadFreeTierRiskAccounts(),
        selectedRiskUserId === targetUserId ? loadSelectedRiskDetails(targetUserId) : Promise.resolve(),
      ]);
    } catch (error: any) {
      toast({
        title: "Device reset failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResettingRiskDeviceUserId(null);
    }
  };

  const handleReputationVisibilityUpdate = async (reviewId: string) => {
    const nextVisibility = reviewVisibilityDrafts[reviewId];
    const target = reputationReviews.find((item) => item.review_id === reviewId);
    if (!target || !nextVisibility || target.visibility === nextVisibility) return;

    setSavingReviewId(reviewId);
    try {
      const { error } = await supabase.rpc("admin_set_vendor_reputation_visibility" as any, {
        review_id: reviewId,
        new_visibility: nextVisibility,
      });
      if (error) throw error;

      toast({
        title: "Review visibility updated",
        description: `${target.vendor_name} scorecard is now ${nextVisibility.replace("_", " ")}.`,
      });

      await Promise.all([loadReputationReviews(), loadReputationMetrics()]);
    } catch (error: any) {
      toast({
        title: "Visibility update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleAiPlanConfigSave = async (audience: AiAudience) => {
    const monthlyCap = Number(aiCapDrafts[audience] ?? 0);
    if (!Number.isFinite(monthlyCap) || monthlyCap < 0) {
      toast({
        title: "Invalid AI cap",
        description: "Monthly AI cap must be 0 or greater.",
        variant: "destructive",
      });
      return;
    }

    setSavingAiAudience(audience);
    try {
      const { error } = await supabase.rpc("admin_set_ai_plan_config" as any, {
        audience_input: audience,
        monthly_message_cap_input: monthlyCap,
        ai_enabled_input: aiEnabledDrafts[audience] ?? true,
        add_on_separate_input: aiAddonSeparateDrafts[audience] ?? false,
        add_on_lookup_key_input: aiAddonLookupDrafts[audience]?.trim() || null,
        add_on_annual_lookup_key_input: aiAddonAnnualLookupDrafts[audience]?.trim() || null,
      });
      if (error) throw error;

      toast({
        title: "AI plan updated",
        description: `${audience} AI settings were saved.`,
      });

      await Promise.all([loadAiPlanConfigs(), loadAiUsageMetrics(), loadAiUsageRows()]);
    } catch (error: any) {
      toast({
        title: "AI plan update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingAiAudience(null);
    }
  };

  const handlePricingCatalogSave = async () => {
    if (!pricingCatalogDraft) return;

    setSavingPricingCatalog(true);
    try {
      const normalizedConfig = normalizePricingCatalogConfig(pricingCatalogDraft);
      const { error } = await supabase.rpc("admin_set_active_pricing_catalog" as any, {
        next_config: normalizedConfig,
        next_display_name: pricingDisplayNameDraft.trim() || "Default Live Pricing Catalog",
      });
      if (error) throw error;

      toast({
        title: "Pricing catalog updated",
        description: "Live pricing settings were saved to Supabase.",
      });

      await Promise.all([loadPricingCatalog(), loadPricingHistory()]);
    } catch (error: any) {
      toast({
        title: "Pricing update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingPricingCatalog(false);
    }
  };

  const handleLoadPricingRevisionDraft = (revision: AdminPricingRevisionRow) => {
    const nextConfig = asAdminPricingCatalogConfig(revision.config);
    setPricingCatalogDraft(nextConfig);
    setPricingDisplayNameDraft(revision.display_name);
    toast({
      title: "Revision loaded",
      description: "This revision is now staged in the editor. Save pricing when you are ready to make it live.",
    });
  };

  const handleRestorePricingRevision = async (revision: AdminPricingRevisionRow) => {
    setRestoringPricingRevisionId(revision.id);
    try {
      const { error } = await supabase.rpc("admin_restore_pricing_catalog_revision" as any, {
        revision_id: revision.id,
      });
      if (error) throw error;

      toast({
        title: "Pricing restored",
        description: `${revision.display_name} is live again.`,
      });

      await Promise.all([loadPricingCatalog(), loadPricingHistory()]);
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRestoringPricingRevisionId(null);
    }
  };

  const handleEstimatorSeedSave = async () => {
    const normalizedAmount = Number(estimatorSeedForm.amount);
    const normalizedGuestCount = estimatorSeedForm.guestCount.trim() ? Number(estimatorSeedForm.guestCount) : null;

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a price observation amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    if (normalizedGuestCount !== null && (!Number.isFinite(normalizedGuestCount) || normalizedGuestCount <= 0)) {
      toast({
        title: "Invalid guest count",
        description: "Guest count must be empty or greater than zero.",
        variant: "destructive",
      });
      return;
    }

    setSavingEstimatorSeed(true);
    try {
      const { error } = await supabase.rpc("record_vendor_price_observation", {
        observation_amount: normalizedAmount,
        observation_category: estimatorSeedForm.category,
        vendor_name: estimatorSeedForm.vendorName.trim() || "Beta market backfill",
        vendor_listing: null,
        client: null,
        price_type_input: estimatorSeedForm.priceType,
        source_input: "admin_backfill",
        venue_input: null,
        county_input: estimatorSeedForm.county.trim() || null,
        guest_count_input: normalizedGuestCount,
        wedding_style_input: estimatorSeedForm.weddingStyle,
        event_date_input: null,
        notes_input: estimatorSeedForm.notes.trim() || null,
        is_anonymized_input: true,
      });

      if (error) throw error;

      toast({
        title: "Estimator seed saved",
        description: `${estimatorSeedForm.category} now has a new ${estimatorSeedForm.priceType} signal for market learning.`,
      });

      setEstimatorSeedForm((current) => ({
        ...current,
        amount: "",
        guestCount: "",
        notes: "",
      }));

      await loadEstimatorSeeds();
    } catch (error: any) {
      toast({
        title: "Seed save failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEstimatorSeed(false);
    }
  };

  if (loading) {
    return <WorkspacePageSkeleton compact />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Owner controls for access, moderation, and platform health.</p>
        </div>
        <Button variant="outline" onClick={() => loadAll(false)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(metrics?.total_users)}</p>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Vendor Reviews</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(metrics?.pending_vendor_approvals)}</p>
            <Store className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Link Requests</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(metrics?.open_link_requests)}</p>
            <UserCog className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(metrics?.total_tasks)}</p>
            <CheckSquare className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Flagged Scorecards</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.flagged_reviews)}</p>
            <MessageSquareWarning className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">AI Messages This Month</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{countLabel(aiUsageMetrics?.total_messages)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ops">Ops & Beta</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="estimator">Estimator Seeding</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="couples">Wedding Plans</TabsTrigger>
          <TabsTrigger value="risk">Free-tier Risk</TabsTrigger>
          <TabsTrigger value="planners">Planner Moderation</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Moderation</TabsTrigger>
          <TabsTrigger value="ai">AI Controls</TabsTrigger>
          <TabsTrigger value="reputation">Reputation Oversight</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Couples</span><span>{countLabel(metrics?.total_couples)}</span></div>
                <div className="flex justify-between"><span>Planners</span><span>{countLabel(metrics?.total_planners)}</span></div>
                <div className="flex justify-between"><span>Vendors</span><span>{countLabel(metrics?.total_vendors)}</span></div>
                <div className="flex justify-between"><span>Admins</span><span>{countLabel(metrics?.total_admins)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Planning Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Planner Clients</span><span>{countLabel(metrics?.total_clients)}</span></div>
                <div className="flex justify-between"><span>Budget Categories</span><span>{countLabel(metrics?.total_budget_items)}</span></div>
                <div className="flex justify-between"><span>Guests</span><span>{countLabel(metrics?.total_guests)}</span></div>
                <div className="flex justify-between"><span>Vendor Listings</span><span>{countLabel(metrics?.total_vendor_listings)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Profiles missing names</span>
                  <Badge variant={healthSummary.missingNames > 0 ? "destructive" : "success"}>
                    {healthSummary.missingNames}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Listings pending approval</span>
                  <Badge variant={healthSummary.pendingVendorCount > 0 ? "warning" : "success"}>
                    {healthSummary.pendingVendorCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Listings without location</span>
                  <Badge variant={healthSummary.noLocationCount > 0 ? "warning" : "success"}>
                    {healthSummary.noLocationCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Flagged reputation reviews</span>
                  <Badge variant={healthSummary.flaggedReviews > 0 ? "destructive" : "success"}>
                    {healthSummary.flaggedReviews}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Beta Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Active beta trials</span><span>{countLabel(betaSnapshot?.active_beta_trials)}</span></div>
                <div className="flex justify-between"><span>Recent failed syncs</span><span>{countLabel(betaSnapshot?.recent_failed_syncs)}</span></div>
                <div className="flex justify-between"><span>Recent AI failures</span><span>{countLabel(betaSnapshot?.recent_ai_failures)}</span></div>
                <div className="flex justify-between"><span>Wedding entitlements</span><span>{countLabel(betaSnapshot?.active_wedding_entitlements)}</span></div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Admin actions are executed through secure RPCs and blocked for non-admin users at the database layer.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Beta Trials</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{countLabel(betaSnapshot?.active_beta_trials)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Couple Plans</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{countLabel(betaSnapshot?.active_couple_passes)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Professional Subs</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {countLabel((betaSnapshot?.active_planner_subscriptions ?? 0) + (betaSnapshot?.active_vendor_subscriptions ?? 0))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Recent Runtime Failures</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {countLabel((betaSnapshot?.recent_failed_syncs ?? 0) + (betaSnapshot?.recent_ai_failures ?? 0))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Function Failures</CardTitle>
              <CardDescription>
                Runtime failures from checkout activation and AI requests. This gives admins a quick operational view during beta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {functionEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        No recent function failures logged.
                      </TableCell>
                    </TableRow>
                  ) : functionEvents.map((row) => (
                    <TableRow key={`${row.function_name}-${row.created_at}-${row.request_id ?? "no-request-id"}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.function_name}</div>
                        {row.request_id ? (
                          <div className="text-[11px] text-muted-foreground">Request: {row.request_id}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.severity === "error" ? "destructive" : "secondary"}>
                          {row.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.audience ?? "n/a"}
                      </TableCell>
                      <TableCell className="max-w-[420px] text-sm text-foreground">
                        {row.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Pricing Catalog</CardTitle>
              <CardDescription>
                Change plan names, copy, displayed prices, and checkout lookup keys here. Zania saves this to Supabase and the pricing page reads it live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catalog name</label>
                  <Input
                    value={pricingDisplayNameDraft}
                    onChange={(e) => setPricingDisplayNameDraft(e.target.value)}
                    placeholder="Default Live Pricing Catalog"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {pricingCatalog?.updated_at ? `Last updated ${new Date(pricingCatalog.updated_at).toLocaleString()}` : "No active catalog loaded yet."}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void loadPricingCatalog()} disabled={loadingPricingCatalog || savingPricingCatalog}>
                  {loadingPricingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reload pricing
                </Button>
                <Button variant="outline" onClick={() => void loadPricingHistory()} disabled={loadingPricingHistory || savingPricingCatalog}>
                  {loadingPricingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                  Reload history
                </Button>
                <Button onClick={() => void handlePricingCatalogSave()} disabled={!pricingCatalogDraft || savingPricingCatalog}>
                  {savingPricingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
                  Save pricing
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing Revision History</CardTitle>
              <CardDescription>
                Every admin save creates a snapshot. Load an older revision into the editor to inspect it, or restore it live in one step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Catalog</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        {loadingPricingHistory ? "Loading pricing revisions..." : "No pricing revisions have been saved yet."}
                      </TableCell>
                    </TableRow>
                  ) : pricingHistory.map((revision) => {
                    const revisionConfig = asAdminPricingCatalogConfig(revision.config);
                    const lookupCount = deriveAllowedLookupKeys(revisionConfig).length;
                    const couplePlanCount = Object.keys(revisionConfig.couplePlans ?? {}).length;
                    const professionalPlanCount = Object.values(revisionConfig.professionalPlans ?? {}).reduce((count, tierMap) => {
                      return count + Object.keys(tierMap ?? {}).length;
                    }, 0);

                    return (
                      <TableRow key={revision.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(revision.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{revision.display_name}</div>
                          <div className="text-[11px] text-muted-foreground">{revision.catalog_key}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={revision.change_source === "admin_restore" ? "outline" : "secondary"}>
                            {revision.change_source === "admin_restore"
                              ? "Restore"
                              : revision.change_source === "initial_import"
                                ? "Initial import"
                                : "Save"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {couplePlanCount} couple plans, {professionalPlanCount} professional plans, {lookupCount} lookup keys
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadPricingRevisionDraft(revision)}
                              disabled={savingPricingCatalog || restoringPricingRevisionId === revision.id}
                            >
                              Load to editor
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleRestorePricingRevision(revision)}
                              disabled={savingPricingCatalog || restoringPricingRevisionId === revision.id}
                            >
                              {restoringPricingRevisionId === revision.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              Restore live
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {pricingAudienceCards.map((item) => {
              const plan = pricingCatalogDraft?.audiencePlans?.[item.key] ?? {};
              return (
                <Card key={item.key}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.label} pricing card</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title</label>
                      <Input value={plan.title ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "title", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pricing model</label>
                      <Input value={plan.pricingModel ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "pricingModel", e.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Subtitle</label>
                      <Textarea value={plan.subtitle ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "subtitle", e.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Free tier name</label>
                      <Input value={plan.freeTierName ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "freeTierName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Paid tier name</label>
                      <Input value={plan.paidTierName ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "paidTierName", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Display one-time price</label>
                      <Input type="number" value={plan.displayOneTimePriceKes ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "displayOneTimePriceKes", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">One-time checkout key</label>
                      <Input value={plan.checkoutOneTimeLookupKey ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "checkoutOneTimeLookupKey", getTrimmedOrNull(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Display monthly price</label>
                      <Input type="number" value={plan.displayMonthlyPriceKes ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "displayMonthlyPriceKes", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Monthly checkout key</label>
                      <Input value={plan.checkoutMonthlyLookupKey ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "checkoutMonthlyLookupKey", getTrimmedOrNull(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Display annual price</label>
                      <Input type="number" value={plan.displayAnnualPriceKes ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "displayAnnualPriceKes", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Annual checkout key</label>
                      <Input value={plan.checkoutAnnualLookupKey ?? ""} onChange={(e) => updateAudiencePricingDraft(item.key, "checkoutAnnualLookupKey", getTrimmedOrNull(e.target.value))} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {pricingCouplePlanCards.map((item) => {
              const plan = pricingCatalogDraft?.couplePlans?.[item.key] ?? {};
              return (
                <Card key={item.key}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input value={plan.title ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "title", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tagline</label>
                        <Input value={plan.tagline ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "tagline", e.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Support copy</label>
                        <Textarea value={plan.supportCopy ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "supportCopy", e.target.value)} rows={4} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly price</label>
                        <Input type="number" value={plan.monthlyPriceKes ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "monthlyPriceKes", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Annual price</label>
                        <Input type="number" value={plan.annualPriceKes ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "annualPriceKes", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly checkout key</label>
                        <Input value={plan.checkoutMonthlyLookupKey ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "checkoutMonthlyLookupKey", getTrimmedOrNull(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Annual checkout key</label>
                        <Input value={plan.checkoutAnnualLookupKey ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "checkoutAnnualLookupKey", getTrimmedOrNull(e.target.value))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">CTA label</label>
                        <Input value={plan.ctaLabel ?? ""} onChange={(e) => updateCouplePlanDraft(item.key, "ctaLabel", e.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Included features</label>
                        <Textarea
                          value={(plan.includedFeatures ?? []).join("\n")}
                          onChange={(e) => updateCouplePlanDraft(item.key, "includedFeatures", e.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
                          rows={5}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {pricingProfessionalPlanCards.map((item) => {
              const plan = pricingCatalogDraft?.professionalPlans?.[item.audience]?.[item.tier] ?? {};
              return (
                <Card key={`${item.audience}-${item.tier}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input value={plan.title ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "title", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tagline</label>
                        <Input value={plan.tagline ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "tagline", e.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Support copy</label>
                        <Textarea value={plan.supportCopy ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "supportCopy", e.target.value)} rows={4} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly price</label>
                        <Input type="number" value={plan.monthlyPriceKes ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "monthlyPriceKes", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Annual price</label>
                        <Input type="number" value={plan.annualPriceKes ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "annualPriceKes", e.target.value ? Number(e.target.value) : null)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Monthly checkout key</label>
                        <Input value={plan.checkoutMonthlyLookupKey ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "checkoutMonthlyLookupKey", getTrimmedOrNull(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Annual checkout key</label>
                        <Input value={plan.checkoutAnnualLookupKey ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "checkoutAnnualLookupKey", getTrimmedOrNull(e.target.value))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">CTA label</label>
                        <Input value={plan.ctaLabel ?? ""} onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "ctaLabel", e.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Included features</label>
                        <Textarea
                          value={(plan.includedFeatures ?? []).join("\n")}
                          onChange={(e) => updateProfessionalPlanDraft(item.audience, item.tier, "includedFeatures", e.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
                          rows={5}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                Saving here also refreshes the pricing catalog lookup allowlist and checkout activation mapping behind the scenes, so billing stays aligned with the copy and lookup keys you set above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estimator" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seed Market Intelligence</CardTitle>
                <CardDescription>
                  Add admin-only benchmark signals for weak categories or counties during beta. These entries flow into the same learning engine the public estimator already uses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Signal label</label>
                    <Input
                      value={estimatorSeedForm.vendorName}
                      onChange={(e) => setEstimatorSeedForm((prev) => ({ ...prev, vendorName: e.target.value }))}
                      placeholder="e.g. Nairobi venue benchmark"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={estimatorSeedForm.category}
                      onValueChange={(value) => setEstimatorSeedForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estimatorCategories.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (KES)</label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={estimatorSeedForm.amount}
                      onChange={(e) => setEstimatorSeedForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="e.g. 275000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Signal strength</label>
                    <Select
                      value={estimatorSeedForm.priceType}
                      onValueChange={(value) => setEstimatorSeedForm((prev) => ({ ...prev, priceType: value as EstimatorPriceType }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estimatorPriceTypes.map((priceType) => (
                          <SelectItem key={priceType} value={priceType}>
                            {priceType === "quote" ? "Quote" : priceType === "booked" ? "Booked / invoice" : "Final paid"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">County</label>
                    <Input
                      value={estimatorSeedForm.county}
                      onChange={(e) => setEstimatorSeedForm((prev) => ({ ...prev, county: e.target.value }))}
                      placeholder="e.g. Nairobi"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Guest count band</label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={estimatorSeedForm.guestCount}
                      onChange={(e) => setEstimatorSeedForm((prev) => ({ ...prev, guestCount: e.target.value }))}
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Wedding style</label>
                    <Select
                      value={estimatorSeedForm.weddingStyle}
                      onValueChange={(value) => setEstimatorSeedForm((prev) => ({ ...prev, weddingStyle: value as EstimatorWeddingStyle }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estimatorWeddingStyles.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style.charAt(0).toUpperCase() + style.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      value={estimatorSeedForm.notes}
                      onChange={(e) => setEstimatorSeedForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Optional source notes, event context, or why this benchmark matters."
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    Use this for beta backfills and benchmark correction only. Real vendor quotes, invoices, and receipts should remain the primary source of truth over time.
                  </p>
                  <Button onClick={handleEstimatorSeedSave} disabled={savingEstimatorSeed}>
                    {savingEstimatorSeed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                    Save estimator seed
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Beta Backfills</CardTitle>
                  <CardDescription>
                    The latest admin-sourced benchmark signals feeding the estimator.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingEstimatorSeeds ? (
                    <div className="flex min-h-24 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : estimatorSeeds.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No admin backfills yet. Add a few category/county anchors here to improve public estimates while vendor data is still sparse.
                    </div>
                  ) : (
                    estimatorSeeds.map((seed) => (
                      <div key={seed.id} className="rounded-2xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{seed.category}</p>
                            <p className="text-xs text-muted-foreground">
                              {seed.vendor_name_snapshot} • {new Date(seed.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline">{seed.price_type.replace("_", " ")}</Badge>
                        </div>
                        <p className="mt-3 text-xl font-semibold">KES {Number(seed.amount).toLocaleString()}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {seed.location_county ? <span>{seed.location_county}</span> : null}
                          {seed.guest_count ? <span>{seed.guest_count} guests</span> : null}
                          {seed.wedding_style ? <span>{seed.wedding_style}</span> : null}
                        </div>
                        {seed.notes ? (
                          <p className="mt-3 text-sm text-muted-foreground">{seed.notes}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-accent/40 bg-accent/15">
                <CardContent className="py-4">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Admin backfills should be used to strengthen empty categories, not to override healthy live market signals.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Search & Filter</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email"
                />
                <Select value={userRoleFilter} onValueChange={(value) => setUserRoleFilter(value as UserRoleFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyUserFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>New Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No users matched your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {users.map((item) => {
                    const nextRole = roleDrafts[item.user_id] ?? item.role;
                    const roleChanged = nextRole !== item.role;
                    const isCurrentAdmin = item.user_id === user?.id;

                    return (
                      <TableRow key={item.user_id}>
                        <TableCell>
                          <p className="font-medium">{item.full_name || item.company_name || "Unnamed User"}</p>
                          <p className="text-xs text-muted-foreground">{item.email || item.user_id}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={nextRole}
                            onValueChange={(value) =>
                              setRoleDrafts((prev) => ({ ...prev, [item.user_id]: value as AppRole }))
                            }
                            disabled={isCurrentAdmin}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((role) => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {isCurrentAdmin ? (
                            <Badge variant="secondary">Current Admin</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant={roleChanged ? "default" : "outline"}
                              disabled={!roleChanged || savingUserId === item.user_id}
                              onClick={() => handleRoleUpdate(item.user_id)}
                            >
                              {savingUserId === item.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="couples" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Couple Wedding Plan Access</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={coupleSearch}
                  onChange={(e) => setCoupleSearch(e.target.value)}
                  placeholder="Search by couple name, email, or wedding location"
                />
                <Select value={planningPassFilter} onValueChange={(value) => setPlanningPassFilter(value as PlanningPassFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyCoupleFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Couple</TableHead>
                    <TableHead>Wedding</TableHead>
                    <TableHead>Wedding Plan</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {couples.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No couples matched your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {couples.map((item) => (
                    <TableRow key={item.user_id}>
                      <TableCell>
                        <p className="font-medium">{item.full_name || "Unnamed Couple"}</p>
                        <p className="text-xs text-muted-foreground">{item.email || item.user_id}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.wedding_location || "Location not set"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.wedding_date ? new Date(item.wedding_date).toLocaleDateString() : "Wedding date not set"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Select
                            value={planningPassDrafts[item.user_id] ?? item.planning_pass_status}
                            onValueChange={(value) =>
                              setPlanningPassDrafts((prev) => ({
                                ...prev,
                                [item.user_id]: value as AdminCouplePassRow["planning_pass_status"],
                              }))
                            }
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inactive">inactive</SelectItem>
                              <SelectItem value="active">active</SelectItem>
                              <SelectItem value="past_due">past_due</SelectItem>
                              <SelectItem value="cancelled">cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={planningPassExpiryDrafts[item.user_id] ?? ""}
                            onChange={(e) =>
                              setPlanningPassExpiryDrafts((prev) => ({
                                ...prev,
                                [item.user_id]: e.target.value,
                              }))
                            }
                            className="w-[150px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingUserId === item.user_id}
                            onClick={() => handlePlanningPassUpdate(item.user_id)}
                          >
                            Save plan
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.planning_pass_status === "active" ? "success" : "outline"}>
                          {item.planning_pass_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Flagged Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(freeTierRiskSummary?.flagged_accounts)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">High Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(freeTierRiskSummary?.high_risk_accounts)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pending Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(freeTierRiskSummary?.pending_reviews)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Free-tier Risk Queue</CardTitle>
              <CardDescription>
                Review couples showing professional-use signals, repeated workspace churn, or support follow-up needs.
              </CardDescription>
              <div className="flex flex-col gap-3 lg:flex-row">
                <Input
                  value={freeTierRiskSearch}
                  onChange={(e) => setFreeTierRiskSearch(e.target.value)}
                  placeholder="Search by name, email, or account purpose"
                />
                <Select value={freeTierRiskLevelFilter} onValueChange={(value) => setFreeTierRiskLevelFilter(value as FreeTierRiskLevelFilter)}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk levels</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={freeTierReviewFilter} onValueChange={(value) => setFreeTierReviewFilter(value as FreeTierReviewFilter)}>
                  <SelectTrigger className="w-full lg:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All reviews</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyFreeTierRiskFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Wedding History</TableHead>
                    <TableHead>Devices & OTP</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freeTierRiskAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No accounts matched your current risk filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {freeTierRiskAccounts.map((item) => (
                    <TableRow
                      key={item.user_id}
                      className={selectedRiskUserId === item.user_id ? "bg-muted/40" : undefined}
                      onClick={() => setSelectedRiskUserId(item.user_id)}
                    >
                      <TableCell>
                        <p className="font-medium">{item.full_name || "Unnamed Couple"}</p>
                        <p className="text-xs text-muted-foreground">{item.email || item.user_id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.account_purpose?.replace(/_/g, " ") || "purpose not set"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={
                              item.professional_use_risk_level === "high"
                                ? "destructive"
                                : item.professional_use_risk_level === "medium"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {item.professional_use_risk_level} · {item.professional_use_risk_score}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {item.last_risk_calculated_at
                              ? `Updated ${new Date(item.last_risk_calculated_at).toLocaleString()}`
                              : "Risk not calculated yet"}
                          </p>
                          {buildRiskSignals(item)[0] ? (
                            <p className="text-xs text-muted-foreground">{buildRiskSignals(item)[0]}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>{item.lifetime_wedding_count} lifetime</p>
                        <p className="text-xs text-muted-foreground">
                          {item.active_wedding_count} active · {item.deleted_wedding_count} deleted · {item.archived_wedding_count} archived
                        </p>
                        <p className="text-xs text-muted-foreground">{item.export_count} exports recorded</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>{item.device_count} devices · {item.current_trusted_device_count} trusted</p>
                        <p className="text-xs text-muted-foreground">
                          {item.device_switches_last_90_days} switches / 90d · {item.otp_failures_last_30_days} OTP failures / 30d
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.support_review_status === "restricted" ? "destructive" : item.support_review_status === "pending" ? "warning" : item.support_review_status === "approved" ? "success" : "outline"}>
                          {item.support_review_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedRiskAccount && (
            <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Review Actions</CardTitle>
                  <CardDescription>
                    Manage support review state, verify a genuine couple, and restore deleted weddings when needed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Support review status</Label>
                      <Select
                        value={riskReviewStatusDrafts[selectedRiskAccount.user_id] ?? selectedRiskAccount.support_review_status}
                        onValueChange={(value) =>
                          setRiskReviewStatusDrafts((prev) => ({
                            ...prev,
                            [selectedRiskAccount.user_id]: value as FreeTierReviewFilter,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">none</SelectItem>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="restricted">restricted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Verified couple</Label>
                      <Select
                        value={(riskVerifiedCoupleDrafts[selectedRiskAccount.user_id] ?? selectedRiskAccount.verified_couple) ? "true" : "false"}
                        onValueChange={(value) =>
                          setRiskVerifiedCoupleDrafts((prev) => ({
                            ...prev,
                            [selectedRiskAccount.user_id]: value === "true",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Verified</SelectItem>
                          <SelectItem value="false">Not verified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Internal review notes</Label>
                    <Textarea
                      value={riskReviewNotesDrafts[selectedRiskAccount.user_id] ?? ""}
                      onChange={(e) =>
                        setRiskReviewNotesDrafts((prev) => ({
                          ...prev,
                          [selectedRiskAccount.user_id]: e.target.value,
                        }))
                      }
                      rows={4}
                      placeholder="Summarize why this account is approved, pending, or restricted."
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{selectedRiskAccount.collaborator_invite_attempts} collaboration attempts</span>
                    <span>{selectedRiskAccount.export_count} exports</span>
                    <span>{selectedRiskAccount.otp_requests_last_30_days} OTP requests / 30d</span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={savingRiskUserId === selectedRiskAccount.user_id}
                      onClick={() => handleFreeTierReviewSave(selectedRiskAccount.user_id)}
                    >
                      {savingRiskUserId === selectedRiskAccount.user_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save review state
                    </Button>
                    <Button
                      variant="outline"
                      disabled={resettingRiskDeviceUserId === selectedRiskAccount.user_id}
                      onClick={() => handleResetRiskDevices(selectedRiskAccount.user_id)}
                    >
                      {resettingRiskDeviceUserId === selectedRiskAccount.user_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Reset trusted devices
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Risk Signals</CardTitle>
                    <CardDescription>
                      Interpreted reasons this account is appearing in the free-tier review queue.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedRiskAccount.professional_use_risk_level === "high" ? "destructive" : selectedRiskAccount.professional_use_risk_level === "medium" ? "warning" : "outline"}>
                        {selectedRiskAccount.professional_use_risk_level} risk
                      </Badge>
                      <Badge variant={selectedRiskAccount.verified_couple ? "success" : "outline"}>
                        {selectedRiskAccount.verified_couple ? "verified couple" : "not verified"}
                      </Badge>
                      <Badge variant="outline">{formatAccountPurposeLabel(selectedRiskAccount.account_purpose)}</Badge>
                    </div>
                    {selectedRiskSignals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No standout signals beyond the stored risk score yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRiskSignals.map((signal) => (
                          <div key={signal} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                            {signal}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Wedding Lifecycle</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedRiskLifecycle.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No wedding lifecycle records found for this account.</p>
                    ) : selectedRiskLifecycle.map((item) => (
                      <div key={item.wedding_id} className="rounded-lg border border-border/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.created_wedding_name || "Unnamed wedding"}</p>
                            <p className="text-xs text-muted-foreground">
                              Created {new Date(item.created_at).toLocaleDateString()}
                              {item.wedding_date ? ` · Wedding date ${new Date(item.wedding_date).toLocaleDateString()}` : ""}
                            </p>
                          </div>
                          <Badge variant={item.status === "deleted" ? "destructive" : item.status === "archived" ? "warning" : "outline"}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <p>{item.workspace_lifetime_days ?? 0} lifetime days · {item.guest_count_at_deletion ?? 0} guests at deletion · {item.export_count ?? 0} exports</p>
                          <p>{item.is_meaningful ? "Meaningful workspace" : "Low-activity workspace"}{item.deletion_reason ? ` · Reason: ${item.deletion_reason}` : ""}</p>
                        </div>
                        {item.status === "deleted" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            disabled={restoringRiskWeddingId === item.wedding_id}
                            onClick={() => handleRestoreDeletedWedding(item.wedding_id)}
                          >
                            {restoringRiskWeddingId === item.wedding_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                            Restore as archived
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Account Activity</CardTitle>
                    <CardDescription>
                      Latest audit events for exports, device changes, support actions, and blocked plan behavior.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedRiskEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent audit events found for this account.</p>
                    ) : selectedRiskEvents.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{formatRiskEventType(event.event_type)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline">{event.wedding_id ? "workspace-linked" : "account-level"}</Badge>
                        </div>
                        <p className="mt-3 text-sm">{summarizeRiskEvent(event)}</p>
                        {formatRiskEventMetadata(event.metadata) ? (
                          <p className="mt-2 text-xs text-muted-foreground">{formatRiskEventMetadata(event.metadata)}</p>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Vendor Suggestions</CardTitle>
              <CardDescription>
                Review directory suggestions from planners and couples, then convert the best ones into curated listings.
              </CardDescription>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={vendorSuggestionSearch}
                  onChange={(e) => setVendorSuggestionSearch(e.target.value)}
                  placeholder="Search by vendor, suggester, category, or location"
                />
                <Select value={vendorSuggestionFilter} onValueChange={(value) => setVendorSuggestionFilter(value as VendorSuggestionFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyVendorSuggestionFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Suggested Vendor</TableHead>
                    <TableHead>Recommended By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Why They Matter</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorSuggestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No vendor suggestions found.
                      </TableCell>
                    </TableRow>
                  )}
                  {vendorSuggestions.map((item) => (
                    <TableRow key={item.suggestion_id}>
                      <TableCell>
                        <p className="font-medium">{item.vendor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category}
                          {item.location ? ` • ${item.location}` : ""}
                          {item.instagram_or_website ? ` • ${item.instagram_or_website}` : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.suggester_name || "Unknown user"}</p>
                        <p className="text-xs text-muted-foreground">{[item.suggester_role, item.suggester_email].filter(Boolean).join(" • ")}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "pending" ? "warning" : item.status === "converted" ? "success" : item.status === "rejected" ? "destructive" : "outline"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                        {item.recommendation_reason}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {item.status !== "converted" && (
                            <Button
                              size="sm"
                              disabled={savingVendorId === item.suggestion_id}
                              onClick={() => handleVendorSuggestionConvert(item.suggestion_id)}
                            >
                              {savingVendorId === item.suggestion_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Convert to curated
                            </Button>
                          )}
                          {item.status !== "reviewed" && item.status !== "converted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingVendorId === item.suggestion_id}
                              onClick={() => handleVendorSuggestionStatus(item.suggestion_id, "reviewed")}
                            >
                              Review
                            </Button>
                          )}
                          {item.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingVendorId === item.suggestion_id}
                              onClick={() => handleVendorSuggestionStatus(item.suggestion_id, "rejected")}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Review Queue</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search by business, owner, or category"
                />
                <Select value={vendorStatusFilter} onValueChange={(value) => setVendorStatusFilter(value as VendorStatusFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                    <SelectItem value="curated">Curated</SelectItem>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyVendorFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Directory Profile</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No vendor listings found.
                      </TableCell>
                    </TableRow>
                  )}
                  {vendors.map((item) => (
                    <TableRow key={item.listing_id}>
                      <TableCell>
                        <p className="font-medium">{item.business_name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}{item.location ? ` • ${item.location}` : ""}</p>
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Badge variant={item.is_approved ? "secondary" : "outline"}>
                          {item.is_approved ? "Approved" : "Pending"}
                        </Badge>
                        <Badge variant={item.is_verified ? "secondary" : "outline"}>
                          {item.is_verified ? "Verified" : "Unverified"}
                        </Badge>
                        {item.verification_requested && !item.is_verified && (
                          <Badge variant="outline">Verification requested</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.owner_name || (item.user_id ? "Unknown owner" : "Curated listing")}</p>
                        <p className="text-xs text-muted-foreground">{item.owner_email || item.user_id || "No claimed vendor yet"}</p>
                        {!item.user_id && item.claim_contact_email && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Claim invite: {item.claim_contact_email}
                            {item.claim_expires_at ? ` until ${new Date(item.claim_expires_at).toLocaleDateString()}` : ""}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Select
                            value={vendorProfileKindDrafts[item.listing_id] ?? item.profile_kind}
                            onValueChange={(value) =>
                              setVendorProfileKindDrafts((prev) => ({
                                ...prev,
                                [item.listing_id]: value as AdminVendorRow["profile_kind"],
                              }))
                            }
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claimed">claimed</SelectItem>
                              <SelectItem value="curated">curated</SelectItem>
                              <SelectItem value="featured">featured</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={vendorFeaturedRankDrafts[item.listing_id] ?? "0"}
                            onChange={(e) =>
                              setVendorFeaturedRankDrafts((prev) => ({
                                ...prev,
                                [item.listing_id]: e.target.value,
                              }))
                            }
                            placeholder="Featured rank"
                            type="number"
                            min="0"
                            className="w-[150px]"
                          />
                          <Textarea
                            value={vendorProfileNoteDrafts[item.listing_id] ?? ""}
                            onChange={(e) =>
                              setVendorProfileNoteDrafts((prev) => ({
                                ...prev,
                                [item.listing_id]: e.target.value,
                              }))
                            }
                            placeholder="Public listing note"
                            rows={3}
                            className="min-w-[240px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingVendorId === item.listing_id}
                            onClick={() => handleVendorProfileSave(item.listing_id)}
                          >
                            Save profile
                          </Button>
                          {!item.user_id && (
                            <div className="space-y-2 rounded-lg border border-dashed border-border/70 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Vendor claim invite
                              </p>
                              <Input
                                type="email"
                                value={vendorClaimEmailDrafts[item.listing_id] ?? ""}
                                onChange={(e) =>
                                  setVendorClaimEmailDrafts((prev) => ({
                                    ...prev,
                                    [item.listing_id]: e.target.value,
                                  }))
                                }
                                placeholder="vendor@example.com"
                                className="min-w-[240px]"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingVendorId === item.listing_id}
                                onClick={() => handleVendorClaimInvite(item.listing_id)}
                              >
                                Create claim link
                              </Button>
                              {vendorClaimLinkDrafts[item.listing_id] && (
                                <div className="space-y-2">
                                  <Input readOnly value={vendorClaimLinkDrafts[item.listing_id]} className="min-w-[240px]" />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      const claimLink = vendorClaimLinkDrafts[item.listing_id];
                                      if (!claimLink) return;
                                      const copied = await navigator.clipboard.writeText(claimLink).then(() => true).catch(() => false);
                                      toast({
                                        title: copied ? "Claim link copied" : "Could not copy claim link",
                                        description: copied ? "Share the link with the vendor." : "Copy and share the claim URL manually.",
                                        variant: copied ? "default" : "destructive",
                                      });
                                    }}
                                  >
                                    Copy claim link
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Select
                            value={subscriptionDrafts[item.listing_id] ?? item.subscription_status}
                            onValueChange={(value) =>
                              setSubscriptionDrafts((prev) => ({
                                ...prev,
                                [item.listing_id]: value as AdminVendorRow["subscription_status"],
                              }))
                            }
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inactive">inactive</SelectItem>
                              <SelectItem value="active">active</SelectItem>
                              <SelectItem value="past_due">past_due</SelectItem>
                              <SelectItem value="cancelled">cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={subscriptionExpiryDrafts[item.listing_id] ?? ""}
                            onChange={(e) =>
                              setSubscriptionExpiryDrafts((prev) => ({
                                ...prev,
                                [item.listing_id]: e.target.value,
                              }))
                            }
                            className="w-[150px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingVendorId === item.listing_id}
                            onClick={() => handleVendorSubscriptionUpdate(item.listing_id)}
                          >
                            Save subscription
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString()}
                        {item.verification_requested_at && !item.is_verified && (
                          <p className="mt-1">Requested {new Date(item.verification_requested_at).toLocaleDateString()}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!item.is_approved ? (
                            <Button
                              size="sm"
                              disabled={savingVendorId === item.listing_id}
                              onClick={() => handleVendorReview(item.listing_id, true, item.is_verified)}
                            >
                              {savingVendorId === item.listing_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingVendorId === item.listing_id}
                              onClick={() => handleVendorReview(item.listing_id, false, false)}
                            >
                              {savingVendorId === item.listing_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Move to Pending
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              savingVendorId === item.listing_id ||
                              !item.is_approved ||
                              subscriptionDrafts[item.listing_id] !== "active"
                            }
                            onClick={() => handleVendorReview(item.listing_id, true, !item.is_verified)}
                          >
                            {item.is_verified ? "Unverify" : item.verification_requested ? "Verify request" : "Verify"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {vendors.length > 0 && vendors.some((item) => !item.is_approved) && (
            <Card className="border-accent/40 bg-accent/15">
              <CardContent className="py-4">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Pending listings are hidden from the public directory until approved.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="planners" className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Planner & Committee Access Review</CardTitle>
              <CardDescription>
                Committee export access is controlled here too. When a committee workspace is active and verified, exports and other full coordination features unlock for that account.
              </CardDescription>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={plannerSearch}
                  onChange={(e) => setPlannerSearch(e.target.value)}
                  placeholder="Search by name, company, committee, or email"
                />
                <Select value={plannerVerificationFilter} onValueChange={(value) => setPlannerVerificationFilter(value as PlannerVerificationFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All planners</SelectItem>
                    <SelectItem value="requested">Verification requested</SelectItem>
                    <SelectItem value="pending">Unverified</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="founding">Founding contributors</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyPlannerFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planner</TableHead>
                    <TableHead>Type / Status</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Founding</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planners.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No planner profiles found.
                      </TableCell>
                    </TableRow>
                  )}
                  {planners.map((item) => (
                    <TableRow key={item.user_id}>
                      <TableCell>
                        <p className="font-medium">
                          {item.planner_type === 'committee'
                            ? item.committee_name || item.full_name || 'Unnamed Committee'
                            : item.company_name || item.full_name || 'Unnamed Planner'}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.company_email || item.user_id}</p>
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Badge variant="outline">
                          {item.planner_type === 'committee' ? 'Committee' : 'Professional'}
                        </Badge>
                        {item.planner_type === 'committee' && (
                          <Badge variant={item.planner_subscription_status === "active" && item.planner_verified ? "success" : "outline"}>
                            {item.planner_subscription_status === "active" && item.planner_verified ? 'Exports enabled' : 'Exports locked'}
                          </Badge>
                        )}
                        <Badge variant={item.planner_verified ? "success" : "outline"}>
                          {item.planner_verified ? "Verified" : "Unverified"}
                        </Badge>
                        {item.planner_verification_requested && !item.planner_verified && (
                          <Badge variant="outline">Verification requested</Badge>
                        )}
                        {item.founding_planner_contributor && (
                          <Badge className="border-0 bg-[#ead8a8] text-[#4c3528]">Founding contributor</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Select
                            value={plannerSubscriptionDrafts[item.user_id] ?? item.planner_subscription_status}
                            onValueChange={(value) =>
                              setPlannerSubscriptionDrafts((prev) => ({
                                ...prev,
                                [item.user_id]: value as AdminPlannerRow["planner_subscription_status"],
                              }))
                            }
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inactive">inactive</SelectItem>
                              <SelectItem value="active">active</SelectItem>
                              <SelectItem value="past_due">past_due</SelectItem>
                              <SelectItem value="cancelled">cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={plannerSubscriptionExpiryDrafts[item.user_id] ?? ""}
                            onChange={(e) =>
                              setPlannerSubscriptionExpiryDrafts((prev) => ({
                                ...prev,
                                [item.user_id]: e.target.value,
                              }))
                            }
                            className="w-[150px]"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={plannerVerificationDrafts[item.user_id] ?? item.planner_verified}
                              onChange={(e) =>
                                setPlannerVerificationDrafts((prev) => ({
                                  ...prev,
                                  [item.user_id]: e.target.checked,
                                }))
                              }
                            />
                            <span className="text-sm">Verified</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={plannerFoundingDrafts[item.user_id] ?? item.founding_planner_contributor}
                              onChange={(e) =>
                                setPlannerFoundingDrafts((prev) => ({
                                  ...prev,
                                  [item.user_id]: e.target.checked,
                                }))
                              }
                            />
                            <span className="text-sm">Founding planner contributor</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingUserId === item.user_id}
                            onClick={() => handlePlannerFoundingUpdate(item.user_id)}
                          >
                            Save founding
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString()}
                        {item.planner_verification_requested_at && !item.planner_verified && (
                          <p className="mt-1">Requested {new Date(item.planner_verification_requested_at).toLocaleDateString()}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={savingUserId === item.user_id}
                          onClick={() => handlePlannerAccessUpdate(item.user_id)}
                        >
                          {savingUserId === item.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Save access
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Month AI Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Total messages</span><span>{countLabel(aiUsageMetrics?.total_messages)}</span></div>
                <div className="flex justify-between"><span>Active AI users</span><span>{countLabel(aiUsageMetrics?.active_users)}</span></div>
                <div className="flex justify-between"><span>Couple messages</span><span>{countLabel(aiUsageMetrics?.couple_messages)}</span></div>
                <div className="flex justify-between"><span>Committee messages</span><span>{countLabel(aiUsageMetrics?.committee_messages)}</span></div>
                <div className="flex justify-between"><span>Planner messages</span><span>{countLabel(aiUsageMetrics?.planner_messages)}</span></div>
                <div className="flex justify-between"><span>Vendor messages</span><span>{countLabel(aiUsageMetrics?.vendor_messages)}</span></div>
              </CardContent>
            </Card>

            <Card className="md:col-span-1 xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">AI Control Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  AI usage is counted per user message and resets monthly. Each audience can have its own cap,
                  can be disabled, and can be marked as payment-ready for a separate add-on later.
                </p>
                <p>
                  Separate add-on lookup keys are optional right now. Leaving them blank keeps AI bundled into the
                  base plan while still preserving a clean upgrade path later.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiPlanConfigs.map((config) => (
                <div key={config.audience} className="rounded-2xl border border-border/70 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold capitalize">{config.audience}</p>
                      <p className="text-sm text-muted-foreground">
                        Updated {new Date(config.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={aiEnabledDrafts[config.audience] ? "secondary" : "outline"}>
                        {aiEnabledDrafts[config.audience] ? "AI enabled" : "AI disabled"}
                      </Badge>
                      <Badge variant={aiAddonSeparateDrafts[config.audience] ? "secondary" : "outline"}>
                        {aiAddonSeparateDrafts[config.audience] ? "Separate AI add-on ready" : "Bundled with base plan"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly cap</label>
                      <Input
                        type="number"
                        min={0}
                        value={aiCapDrafts[config.audience] ?? "0"}
                        onChange={(event) => setAiCapDrafts((prev) => ({ ...prev, [config.audience]: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI status</label>
                      <Select
                        value={(aiEnabledDrafts[config.audience] ?? true) ? "enabled" : "disabled"}
                        onValueChange={(value) =>
                          setAiEnabledDrafts((prev) => ({ ...prev, [config.audience]: value === "enabled" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enabled">Enabled</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Billing mode</label>
                      <Select
                        value={(aiAddonSeparateDrafts[config.audience] ?? false) ? "separate" : "bundled"}
                        onValueChange={(value) =>
                          setAiAddonSeparateDrafts((prev) => ({ ...prev, [config.audience]: value === "separate" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bundled">Bundled</SelectItem>
                          <SelectItem value="separate">Separate add-on</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly lookup key</label>
                      <Input
                        value={aiAddonLookupDrafts[config.audience] ?? ""}
                        onChange={(event) =>
                          setAiAddonLookupDrafts((prev) => ({ ...prev, [config.audience]: event.target.value }))
                        }
                        placeholder="ai_add_on_monthly"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Annual lookup key</label>
                      <Input
                        value={aiAddonAnnualLookupDrafts[config.audience] ?? ""}
                        onChange={(event) =>
                          setAiAddonAnnualLookupDrafts((prev) => ({ ...prev, [config.audience]: event.target.value }))
                        }
                        placeholder="ai_add_on_annual"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => handleAiPlanConfigSave(config.audience)}
                      disabled={savingAiAudience === config.audience}
                    >
                      {savingAiAudience === config.audience ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save AI Controls
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">AI Usage by User</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={aiUsageSearch}
                  onChange={(event) => setAiUsageSearch(event.target.value)}
                  placeholder="Search by name or email"
                />
                <Select value={aiAudienceFilter} onValueChange={(value) => setAiAudienceFilter(value as AiAudienceFilter)}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All AI audiences</SelectItem>
                    <SelectItem value="couple">Couples</SelectItem>
                    <SelectItem value="committee">Committees</SelectItem>
                    <SelectItem value="planner">Planners</SelectItem>
                    <SelectItem value="vendor">Vendors</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyAiUsageFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Messages Used</TableHead>
                    <TableHead>Cap</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Month</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiUsageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No AI usage matches the current filters yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    aiUsageRows.map((row) => (
                      <TableRow key={`${row.user_id}-${row.audience}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.full_name || "Unnamed user"}</p>
                            <p className="text-xs text-muted-foreground">{row.email || "No email found"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="capitalize">{row.audience}</Badge>
                            <p className="text-xs text-muted-foreground capitalize">{row.role}</p>
                          </div>
                        </TableCell>
                        <TableCell>{countLabel(row.messages_used)}</TableCell>
                        <TableCell>{countLabel(row.monthly_message_cap)}</TableCell>
                        <TableCell>
                          <Badge variant={row.remaining_messages === 0 ? "destructive" : "secondary"}>
                            {countLabel(row.remaining_messages)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(row.month_start).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reputation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Scorecards</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.total_reviews)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Flagged</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.flagged_reviews)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Planner Network</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.planner_network_reviews)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Admin Only</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.admin_only_reviews)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Private</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{countLabel(reputationMetrics?.private_reviews)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Flagged Review Queue</CardTitle>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={reputationSearch}
                  onChange={(e) => setReputationSearch(e.target.value)}
                  placeholder="Search vendor, reviewer, client, or email"
                />
                <Select value={reputationIssueFilter} onValueChange={(value) => setReputationIssueFilter(value as ReputationIssueFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flagged">Flagged only</SelectItem>
                    <SelectItem value="clean">Clean only</SelectItem>
                    <SelectItem value="all">All reviews</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={reputationVisibilityFilter} onValueChange={(value) => setReputationVisibilityFilter(value as ReputationVisibilityFilter)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All visibility</SelectItem>
                    <SelectItem value="planner_network">Planner network</SelectItem>
                    <SelectItem value="admin_only">Admin only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => applyReputationFilters()}>
                  Apply
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reputationReviews.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No reputation reviews matched your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {reputationReviews.map((item) => {
                    const nextVisibility = reviewVisibilityDrafts[item.review_id] ?? item.visibility;
                    const visibilityChanged = nextVisibility !== item.visibility;

                    return (
                      <TableRow key={item.review_id}>
                        <TableCell>
                          <p className="font-medium">{item.vendor_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.vendor_category}
                            {item.client_name ? ` • ${item.client_name}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{item.reviewer_name || "Unknown reviewer"}</p>
                          <p className="text-xs text-muted-foreground">{item.reviewer_email || item.reviewer_user_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.overall_rating}/5 overall • {item.would_hire_again ? "would hire again" : "would not hire again"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.review_source === 'committee'
                              ? `Committee planned wedding${item.review_source_role ? ` · ${item.review_source_role}` : ''}`
                              : item.review_source === 'admin'
                                ? 'Admin review'
                                : 'Professional planner review'}
                          </p>
                        </TableCell>
                        <TableCell>
                          {item.issue_flags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.issue_flags.map((flag) => (
                                <Badge key={flag} variant="destructive" className="text-[10px]">
                                  {flag.replace(/_/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="secondary">No flags</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={nextVisibility}
                            onValueChange={(value) =>
                              setReviewVisibilityDrafts((prev) => ({
                                ...prev,
                                [item.review_id]: value as ReputationVisibilityFilter,
                              }))
                            }
                          >
                            <SelectTrigger className="w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planner_network">Planner network</SelectItem>
                              <SelectItem value="admin_only">Admin only</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                          {item.private_notes?.trim() ? item.private_notes : "No private notes"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={visibilityChanged ? "default" : "outline"}
                            disabled={!visibilityChanged || savingReviewId === item.review_id}
                            onClick={() => handleReputationVisibilityUpdate(item.review_id)}
                          >
                            {savingReviewId === item.review_id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {reputationMetrics?.flagged_reviews ? (
            <Card className="border-accent/40 bg-accent/15">
              <CardContent className="py-4">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Flagged scorecards should be reviewed for visibility. Keep credible warnings in the planner network; limit sensitive or unverifiable notes to admin-only.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
