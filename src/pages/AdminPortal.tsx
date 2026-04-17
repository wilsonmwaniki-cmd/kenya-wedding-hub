import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, Users, Store, CheckSquare, UserCog, AlertTriangle, MessageSquareWarning, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  user_id: string;
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

type UserRoleFilter = "all" | AppRole;
type VendorStatusFilter = "all" | "pending" | "approved";
type PlannerVerificationFilter = "all" | "pending" | "verified" | "requested";
type PlanningPassFilter = "all" | "inactive" | "active" | "past_due" | "cancelled";
type ReputationIssueFilter = "all" | "flagged" | "clean";
type ReputationVisibilityFilter = "all" | "private" | "planner_network" | "admin_only";
type AiAudience = "couple" | "committee" | "planner" | "vendor";
type AiAudienceFilter = "all" | AiAudience;

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

const roleOptions: AppRole[] = ["couple", "planner", "vendor", "admin"];

function countLabel(value?: number) {
  return Number(value ?? 0).toLocaleString();
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
  const [couples, setCouples] = useState<AdminCouplePassRow[]>([]);
  const [reputationMetrics, setReputationMetrics] = useState<AdminReputationMetrics | null>(null);
  const [reputationReviews, setReputationReviews] = useState<AdminReputationRow[]>([]);
  const [aiUsageMetrics, setAiUsageMetrics] = useState<AdminAiUsageMetrics | null>(null);
  const [aiUsageRows, setAiUsageRows] = useState<AdminAiUsageRow[]>([]);
  const [aiPlanConfigs, setAiPlanConfigs] = useState<AdminAiPlanConfigRow[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, AdminVendorRow["subscription_status"]>>({});
  const [subscriptionExpiryDrafts, setSubscriptionExpiryDrafts] = useState<Record<string, string>>({});
  const [plannerSubscriptionDrafts, setPlannerSubscriptionDrafts] = useState<Record<string, AdminPlannerRow["planner_subscription_status"]>>({});
  const [plannerSubscriptionExpiryDrafts, setPlannerSubscriptionExpiryDrafts] = useState<Record<string, string>>({});
  const [plannerVerificationDrafts, setPlannerVerificationDrafts] = useState<Record<string, boolean>>({});
  const [planningPassDrafts, setPlanningPassDrafts] = useState<Record<string, AdminCouplePassRow["planning_pass_status"]>>({});
  const [planningPassExpiryDrafts, setPlanningPassExpiryDrafts] = useState<Record<string, string>>({});
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

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<VendorStatusFilter>("pending");
  const [plannerSearch, setPlannerSearch] = useState("");
  const [plannerVerificationFilter, setPlannerVerificationFilter] = useState<PlannerVerificationFilter>("all");
  const [coupleSearch, setCoupleSearch] = useState("");
  const [planningPassFilter, setPlanningPassFilter] = useState<PlanningPassFilter>("all");
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

  const loadAll = async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    else setRefreshing(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadUsers(),
        loadVendors(),
        loadPlanners(),
        loadCouples(),
        loadReputationMetrics(),
        loadReputationReviews(),
        loadAiUsageMetrics(),
        loadAiUsageRows(),
        loadAiPlanConfigs(),
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
            <Sparkles className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="couples">Wedding Plans</TabsTrigger>
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
                  <Badge variant={healthSummary.missingNames > 0 ? "destructive" : "secondary"}>
                    {healthSummary.missingNames}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Listings pending approval</span>
                  <Badge variant={healthSummary.pendingVendorCount > 0 ? "outline" : "secondary"}>
                    {healthSummary.pendingVendorCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Listings without location</span>
                  <Badge variant={healthSummary.noLocationCount > 0 ? "outline" : "secondary"}>
                    {healthSummary.noLocationCount}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Flagged reputation reviews</span>
                  <Badge variant={healthSummary.flaggedReviews > 0 ? "destructive" : "secondary"}>
                    {healthSummary.flaggedReviews}
                  </Badge>
                </div>
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
                        <Badge variant={item.planning_pass_status === "active" ? "secondary" : "outline"}>
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

        <TabsContent value="vendors" className="space-y-4">
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
                    <TableHead>Subscription</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                        <p className="text-sm">{item.owner_name || "Unknown owner"}</p>
                        <p className="text-xs text-muted-foreground">{item.owner_email || item.user_id}</p>
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
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-4">
                <p className="flex items-center gap-2 text-sm text-amber-900">
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
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planners.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                          <Badge variant={item.planner_subscription_status === "active" && item.planner_verified ? "secondary" : "outline"}>
                            {item.planner_subscription_status === "active" && item.planner_verified ? 'Exports enabled' : 'Exports locked'}
                          </Badge>
                        )}
                        <Badge variant={item.planner_verified ? "secondary" : "outline"}>
                          {item.planner_verified ? "Verified" : "Unverified"}
                        </Badge>
                        {item.planner_verification_requested && !item.planner_verified && (
                          <Badge variant="outline">Verification requested</Badge>
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
                  can be disabled, and can be marked as Stripe-ready for a separate add-on later.
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
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-4">
                <p className="flex items-center gap-2 text-sm text-amber-900">
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
