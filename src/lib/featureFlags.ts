export function isProfessionalNetworkEnabled() {
  return import.meta.env.VITE_ENABLE_PROFESSIONAL_NETWORK === 'true';
}

export function isSpaceTablePlanEnabled() {
  return import.meta.env.VITE_ENABLE_SPACE_TABLE_PLAN === 'true';
}

export function isAppleAuthEnabled() {
  return import.meta.env.VITE_ENABLE_APPLE_AUTH === 'true';
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
