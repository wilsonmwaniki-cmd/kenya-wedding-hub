import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldAlert, Store } from "lucide-react";

import BrandWordmark from "@/components/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingVendorClaim, persistPendingVendorClaim, readPendingVendorClaim } from "@/lib/vendorClaimState";
import { isProfessionalSetupPending } from "@/lib/roles";

type ClaimStatus = "ready" | "claimed" | "expired";
type ClaimType = "listing" | "workspace_invite";

type ClaimDetails = {
  listing_id: string;
  business_name: string;
  category: string;
  location: string | null;
  claim_contact_email: string | null;
  claim_expires_at: string | null;
  claim_status: ClaimStatus;
};

type WorkspaceInviteClaimDetails = {
  invite_id: string;
  wedding_id: string;
  wedding_name: string;
  wedding_date: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_category: string;
  invite_contact_email: string | null;
  invite_contact_phone: string | null;
  invite_expires_at: string | null;
  invite_status: ClaimStatus | "declined" | "revoked" | "sent" | "opened" | "draft" | "pending";
};

export default function VendorClaim() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tokenFromSearch = searchParams.get("token")?.trim() ?? "";
  const emailFromSearch = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const claimTypeFromSearch = searchParams.get("claim_type") === "workspace_invite" ? "workspace_invite" : "listing";
  const [claim, setClaim] = useState<ClaimDetails | null>(null);
  const [workspaceInviteClaim, setWorkspaceInviteClaim] = useState<WorkspaceInviteClaimDetails | null>(null);
  const [claimToken, setClaimToken] = useState<string>("");
  const [claimType, setClaimType] = useState<ClaimType>("listing");
  const [loadingClaim, setLoadingClaim] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (tokenFromSearch) {
      persistPendingVendorClaim(tokenFromSearch, emailFromSearch || null, claimTypeFromSearch);
      setClaimToken(tokenFromSearch);
      setClaimType(claimTypeFromSearch);
      return;
    }

    const pendingClaim = readPendingVendorClaim();
    if (pendingClaim?.token) {
      setClaimToken(pendingClaim.token);
      setClaimType(pendingClaim.claimType === "workspace_invite" ? "workspace_invite" : "listing");
    }
  }, [claimTypeFromSearch, emailFromSearch, tokenFromSearch]);

  useEffect(() => {
    if (!claimToken) {
      setLoadingClaim(false);
      return;
    }

    let active = true;
    const loadClaim = async () => {
      setLoadingClaim(true);
      const { data, error } = claimType === "workspace_invite"
        ? await supabase.rpc("get_workspace_vendor_invite_claim" as any, {
            invite_token: claimToken,
          })
        : await supabase.rpc("get_vendor_listing_claim" as any, {
            claim_token: claimToken,
          });

      if (!active) return;

      if (error) {
        setClaim(null);
        setWorkspaceInviteClaim(null);
        setLoadingClaim(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (claimType === "workspace_invite") {
        setWorkspaceInviteClaim((row as WorkspaceInviteClaimDetails | null) ?? null);
        setClaim(null);
      } else {
        setClaim((row as ClaimDetails | null) ?? null);
        setWorkspaceInviteClaim(null);
      }
      setLoadingClaim(false);
    };

    void loadClaim();
    return () => {
      active = false;
    };
  }, [claimToken, claimType]);

  useEffect(() => {
    if (loading || !user || !claimToken) return;

    if (isProfessionalSetupPending(user.user_metadata, profile?.role, user.email ?? null)) {
      navigate("/settings?claim_vendor=1", { replace: true });
      return;
    }

    if (profile?.role !== "vendor") return;

    let active = true;
    const claimListing = async () => {
      setClaiming(true);
      const { data, error } = claimType === "workspace_invite"
        ? await supabase.rpc("claim_workspace_vendor_invite" as any, {
            invite_token: claimToken,
          })
        : await supabase.rpc("claim_vendor_listing" as any, {
            claim_token: claimToken,
          });

      if (!active) return;

      if (error) {
        toast({
          title: "Could not claim listing",
          description: error.message,
          variant: "destructive",
        });
        setClaiming(false);
        return;
      }

      clearPendingVendorClaim();
      toast({
        title: claimType === "workspace_invite" ? "Workspace invite accepted" : "Vendor listing claimed",
        description: claimType === "workspace_invite"
          ? "This vendor account is now linked to the wedding workspace invitation."
          : "This vendor profile is now attached to your account.",
      });
      setClaiming(false);
      navigate(
        claimType === "workspace_invite"
          ? "/vendor-dashboard"
          : "/vendor-settings",
        { replace: true, state: claimType === "workspace_invite" ? { claimedWorkspaceInviteId: data } : { claimedListingId: data } },
      );
    };

    void claimListing();
    return () => {
      active = false;
    };
  }, [claimToken, claimType, loading, navigate, profile?.role, toast, user]);

  const handleAuthRedirect = (mode: "signin" | "signup") => {
    if (!claimToken) return;
    persistPendingVendorClaim(
      claimToken,
      claimType === "workspace_invite"
        ? workspaceInviteClaim?.invite_contact_email ?? emailFromSearch ?? null
        : claim?.claim_contact_email ?? emailFromSearch ?? null,
      claimType,
    );

    const params = new URLSearchParams({
      audience: "professional",
      mode,
      flow: "vendor_claim",
    });

    const invitedEmail = claimType === "workspace_invite"
      ? workspaceInviteClaim?.invite_contact_email ?? emailFromSearch
      : claim?.claim_contact_email ?? emailFromSearch;
    if (invitedEmail) {
      params.set("email", invitedEmail);
    }

    navigate(`${mode === 'signin' ? '/sign-in' : '/auth'}?${params.toString()}`);
  };

  const invitedEmail =
    (claimType === "workspace_invite"
      ? workspaceInviteClaim?.invite_contact_email
      : claim?.claim_contact_email)
    ?? emailFromSearch
    ?? readPendingVendorClaim()?.email
    ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-warm p-4">
      <Card className="w-full max-w-2xl border-border/50 shadow-warm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <BrandWordmark size="md" />
          </div>
          <div className="mx-auto rounded-full bg-primary/10 p-3 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">{claimType === "workspace_invite" ? "Join this wedding workspace" : "Claim your vendor profile"}</CardTitle>
          <CardDescription>
            {claimType === "workspace_invite"
              ? "A real client added your business privately to their Zania planning workspace. Join the workspace from your vendor account to collaborate on this wedding."
              : "Accept your Zania listing so you can manage the profile, verification, and vendor workspace from your own account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingClaim ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading claim details...
            </div>
          ) : !claimToken || (claimType === "workspace_invite" ? !workspaceInviteClaim : !claim) ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900">
              This invite link is invalid or unavailable. Ask the sender for a fresh vendor invite.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {claimType === "workspace_invite" ? "Private vendor record invite" : "Vendor profile"}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {claimType === "workspace_invite" ? workspaceInviteClaim?.vendor_name : claim?.business_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {claimType === "workspace_invite"
                    ? `${workspaceInviteClaim?.vendor_category ?? 'Vendor'}${workspaceInviteClaim?.wedding_name ? ` • ${workspaceInviteClaim.wedding_name}` : ""}`
                    : `${claim?.category ?? ''}${claim?.location ? ` • ${claim.location}` : ""}`}
                </p>
                {claimType === "workspace_invite" && workspaceInviteClaim?.wedding_date && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Wedding date: <span className="font-medium text-foreground">{workspaceInviteClaim.wedding_date}</span>
                  </p>
                )}
                {(claimType === "workspace_invite" ? workspaceInviteClaim?.invite_contact_email : claim?.claim_contact_email) && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    This invite was prepared for <span className="font-medium text-foreground">{claimType === "workspace_invite" ? workspaceInviteClaim?.invite_contact_email : claim?.claim_contact_email}</span>.
                  </p>
                )}
              </div>

              {(claimType === "workspace_invite" ? workspaceInviteClaim?.invite_status === "expired" : claim?.claim_status === "expired") && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  This invite link has expired. Ask for a fresh invite.
                </div>
              )}

              {(claimType === "workspace_invite"
                ? workspaceInviteClaim?.invite_status === "accepted"
                : claim?.claim_status === "claimed") && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                  {claimType === "workspace_invite"
                    ? "This workspace invite has already been accepted. Sign in with the vendor account that accepted it if you need to continue."
                    : "This vendor profile has already been claimed. Sign in with the owner account if you need to manage it."}
                </div>
              )}

              {((claimType === "workspace_invite"
                ? ["draft", "pending", "sent", "opened"].includes(workspaceInviteClaim?.invite_status ?? "")
                : claim?.claim_status === "ready")) && !user && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-muted-foreground">
                    Sign in with the invited email to continue. If you do not have a vendor account yet, create one first and choose <span className="font-medium text-foreground">Vendor</span> during setup. This only joins you to this wedding workspace first. A public profile can come later.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button onClick={() => handleAuthRedirect("signin")}>
                      Sign in to join
                    </Button>
                    <Button variant="outline" onClick={() => handleAuthRedirect("signup")}>
                      Create vendor account
                    </Button>
                  </div>
                </div>
              )}

              {((claimType === "workspace_invite"
                ? ["draft", "pending", "sent", "opened"].includes(workspaceInviteClaim?.invite_status ?? "")
                : claim?.claim_status === "ready")) && user && profile?.role !== "vendor" && !isProfessionalSetupPending(user.user_metadata, profile?.role, user.email ?? null) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">This needs a vendor account</p>
                      <p className="mt-1">
                        You are signed in, but this account is not a vendor account yet. Sign out and continue with the invited vendor email, or finish professional setup as a vendor first.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {((claimType === "workspace_invite"
                ? ["draft", "pending", "sent", "opened"].includes(workspaceInviteClaim?.invite_status ?? "")
                : claim?.claim_status === "ready")) && user && profile?.role === "vendor" && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground">
                    <Loader2 className={`h-4 w-4 ${claiming ? "animate-spin" : ""}`} />
                    {claimType === "workspace_invite" ? "Joining the wedding workspace..." : "Finishing your vendor claim..."}
                  </div>
                  <p className="mt-1">
                    {claimType === "workspace_invite"
                      ? <>We are attaching <span className="font-medium text-foreground">{workspaceInviteClaim?.vendor_name}</span> to your vendor account so you can collaborate on this wedding now.</>
                      : <>We are attaching <span className="font-medium text-foreground">{claim?.business_name}</span> to your vendor account now.</>}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Need help? Go back to <Link to="/vendors-directory" className="text-primary underline-offset-4 hover:underline">the vendor directory</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
