export function isProfessionalNetworkEnabled() {
  return import.meta.env.VITE_ENABLE_PROFESSIONAL_NETWORK === 'true';
}

export function isSpaceTablePlanEnabled() {
  return import.meta.env.VITE_ENABLE_SPACE_TABLE_PLAN === 'true';
}

export function isAppleAuthEnabled() {
  return import.meta.env.VITE_ENABLE_APPLE_AUTH === 'true';
}

export function resolvePlanningExperimentEnabled(configured?: string) {
  return configured === 'true';
}

export function isPlanningExperimentEnabled() {
  return resolvePlanningExperimentEnabled(import.meta.env.VITE_ENABLE_PLANNING_EXPERIMENT);
}

export function resolveLeadMarketplaceEnabled(configured?: string) {
  return configured === 'true';
}

export function isLeadMarketplaceEnabled() {
  return resolveLeadMarketplaceEnabled(import.meta.env.VITE_ENABLE_LEAD_MARKETPLACE);
}

export type ReleaseChannel = 'production' | 'staging';

const productionLaunchPaths = new Set([
  '/clients',
  '/dashboard',
  '/start-plan',
  '/budget',
  '/tasks',
  '/vendors',
  '/vendor-dashboard',
  '/vendor-documents',
  '/planner-documents',
  '/vendor-settings',
  '/settings',
]);

export function resolveReleaseChannel(
  configuredChannel?: string,
  isDevelopment = false,
): ReleaseChannel {
  if (configuredChannel === 'staging' || isDevelopment) return 'staging';
  return 'production';
}

export function getReleaseChannel(): ReleaseChannel {
  return resolveReleaseChannel(import.meta.env.VITE_RELEASE_CHANNEL, import.meta.env.DEV);
}

export function isPathEnabledForRelease(path: string, channel: ReleaseChannel) {
  if (channel === 'staging') return true;
  return productionLaunchPaths.has(path);
}

export function isLaunchFeatureEnabled(path: string) {
  return isPathEnabledForRelease(path, getReleaseChannel());
}

export function getProfessionalNetworkPath() {
  return '/labs/network';
}

export function getSpaceTablePlanPath() {
  return '/space-plan';
}

export function getLabsPath() {
  return '/labs';
}

export type LabsFeatureKey = 'professionalNetwork';

export function getEnabledLabsFeatures(): LabsFeatureKey[] {
  const features: LabsFeatureKey[] = [];

  if (isProfessionalNetworkEnabled()) {
    features.push('professionalNetwork');
  }

  return features;
}

export function isLabsEnabled() {
  return getEnabledLabsFeatures().length > 0;
}
