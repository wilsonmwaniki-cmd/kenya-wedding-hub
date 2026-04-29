import type { Database } from "@/integrations/supabase/types";
import { readPendingProfessionalSetup } from "@/lib/professionalSetupState";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PlannerType = "professional" | "committee";
export type SignupRole = Exclude<AppRole, "admin"> | "committee";

export function isProfessionalSetupPending(
  userMetadata: Record<string, unknown> | null | undefined,
  _role?: AppRole | null,
  userEmail?: string | null,
): boolean {
  return (
    (
      userMetadata?.signup_intent === "professional"
      && userMetadata?.professional_role_locked === false
    )
    || readPendingProfessionalSetup(userEmail ?? null)
  );
}

export function getHomeRouteForRole(role: AppRole | null | undefined, plannerType?: PlannerType | null): string {
  if (role === "planner") return plannerType === "committee" ? "/dashboard" : "/clients";
  if (role === "vendor") return "/vendor-settings";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
