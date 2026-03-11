import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, Users, Store, CheckSquare, UserCog, AlertTriangle, MessageSquareWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type UserRoleFilter = "all" | AppRole;
type VendorStatusFilter = "all" | "pending" | "approved";
type ReputationIssueFilter = "all" | "flagged" | "clean";
type ReputationVisibilityFilter = "all" | "private" | "planner_network" | "admin_only";

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
  private_notes: string | null;
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
  const [reputationMetrics, setReputationMetrics] = useState<AdminReputationMetrics | null>(null);
  const [reputationReviews, setReputationReviews] = useState<AdminReputationRow[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, AdminVendorRow["subscription_status"]>>({});
  const [subscriptionExpiryDrafts, setSubscriptionExpiryDrafts] = useState<Record<string, string>>({});
  const [reviewVisibilityDrafts, setReviewVisibilityDrafts] = useState<Record<string, ReputationVisibilityFilter>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingVendorId, setSavingVendorId] = useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<VendorStatusFilter>("pending");
  const [reputationSearch, setReputationSearch] = useState("");
  const [reputationIssueFilter, setReputationIssueFilter] = useState<ReputationIssueFilter>("flagged");
  const [reputationVisibilityFilter, setReputationVisibilityFilter] = useState<ReputationVisibilityFilter>("all");

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

  const loadAll = async (showFullLoader = false) => {
    if (showFullLoader) setLoading(true);
    else setRefreshing(true);
    try {
      await Promise.all([loadMetrics(), loadUsers(), loadVendors(), loadReputationMetrics(), loadReputationReviews()]);
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
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Moderation</TabsTrigger>
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
