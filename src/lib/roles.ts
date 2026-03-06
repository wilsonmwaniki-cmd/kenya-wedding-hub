import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type SignupRole = Exclude<AppRole, "admin">;

export function getHomeRouteForRole(role: AppRole | null | undefined): string {
  if (role === "planner") return "/clients";
  if (role === "vendor") return "/vendor-settings";
  if (role === "admin") return "/admin";
  return "/dashboard";
}
