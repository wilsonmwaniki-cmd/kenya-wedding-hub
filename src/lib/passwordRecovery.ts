import {
  isProductionHostname,
  PRIMARY_PRODUCTION_ORIGIN,
} from '@/lib/appDomain';

export function getPasswordRecoveryRedirectUrl(location: Pick<Location, 'hostname' | 'origin'>) {
  const origin = isProductionHostname(location.hostname)
    ? PRIMARY_PRODUCTION_ORIGIN
    : location.origin;

  return `${origin}/reset-password?type=recovery`;
}
