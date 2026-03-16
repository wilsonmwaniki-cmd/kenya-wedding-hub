import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PlannerType = "professional" | "committee";
export type SignupRole = Exclude<AppRole, "admin"> | "committee";

export function getHomeRouteForRole(role: AppRole | null | undefined, plannerType?: PlannerType | null): string {
  if (role === "planner") return plannerType === "committee" ? "/dashboard" : "/clients";
  if (role === "vendor") return "/vendor-settings";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
