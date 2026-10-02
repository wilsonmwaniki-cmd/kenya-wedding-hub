export const LEGACY_PRODUCTION_HOSTS = [
  'zaniaweddings.com',
  'www.zaniaweddings.com',
] as const;

export const PRIMARY_PRODUCTION_HOST = 'www.planwithzania.com';
export const PRIMARY_PRODUCTION_ORIGIN = `https://${PRIMARY_PRODUCTION_HOST}`;
export const STAGING_HOSTS = [
  'staging.planwithzania.com',
  'app.planwithzania.com',
] as const;

export const ALL_PRODUCTION_HOSTS = [
  ...LEGACY_PRODUCTION_HOSTS,
  'planwithzania.com',
  PRIMARY_PRODUCTION_HOST,
] as const;

export function isProductionHostname(hostname: string) {
  return ALL_PRODUCTION_HOSTS.includes(hostname as (typeof ALL_PRODUCTION_HOSTS)[number]);
}

export function isCanonicalProductionHostname(hostname: string) {
  return hostname === PRIMARY_PRODUCTION_HOST;
}

export function isStagingHostname(hostname: string) {
  return STAGING_HOSTS.includes(hostname as (typeof STAGING_HOSTS)[number]);
}

export function isKnownZaniaHostname(hostname: string) {
  return isProductionHostname(hostname) || isStagingHostname(hostname);
}

export function getCookieDomainForHostname(hostname: string) {
  if (hostname === 'zaniaweddings.com' || hostname === 'www.zaniaweddings.com') {
    return '.zaniaweddings.com';
  }

  if (hostname === 'planwithzania.com' || hostname === 'www.planwithzania.com') {
    return '.planwithzania.com';
  }

  return null;
}
