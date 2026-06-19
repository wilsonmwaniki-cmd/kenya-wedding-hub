import type { AppRole, PlannerType } from '@/lib/roles';

export type AuthRouteTarget = {
  role: AppRole;
  plannerType: PlannerType | null;
};

export function getSafeAuthRouteTarget(
  target: AuthRouteTarget | null | undefined,
): AuthRouteTarget {
  return target ?? { role: 'couple', plannerType: null };
}
