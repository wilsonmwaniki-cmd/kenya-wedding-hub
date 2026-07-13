import { supabase } from '@/integrations/supabase/client';

const APP_INSTALLATION_ID_STORAGE_KEY = 'zania_app_installation_id';

export type DeviceSessionRow = {
  id: string;
  device_id: string;
  device_name: string | null;
  platform: string | null;
  browser: string | null;
  first_seen_at: string;
  last_seen_at: string;
  trusted_at: string | null;
  revoked_at: string | null;
  is_current: boolean;
};

export type DeviceRegistrationResult = {
  status: 'active' | 'verification_required';
  deviceSessionId?: string | null;
  deviceId?: string | null;
  message?: string | null;
  emailHint?: string | null;
  enforcementRequired?: boolean;
};

export type DeviceVerificationSendResult = {
  challengeId: string;
  expiresAt: string;
  retryAfterSeconds: number;
  emailHint?: string | null;
};

export type DeviceVerificationResult = {
  verified: boolean;
  status: 'verified' | 'failed' | 'locked' | 'expired';
  message: string;
  remainingAttempts?: number;
};

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getOrCreateAppInstallationId() {
  if (typeof window === 'undefined') return 'server-installation';

  const existing = window.localStorage.getItem(APP_INSTALLATION_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = randomId();
  window.localStorage.setItem(APP_INSTALLATION_ID_STORAGE_KEY, created);
  return created;
}

export function getCurrentDeviceProfile() {
  const appInstallationId = getOrCreateAppInstallationId();
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const platform = typeof navigator === 'undefined' ? 'unknown' : navigator.platform || 'unknown';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Safari\//.test(ua) && !/Chrome\//.test(ua)
        ? 'Safari'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : 'Browser';

  return {
    deviceId: appInstallationId,
    appInstallationId,
    deviceName: `${browser} on ${platform}`,
    platform,
    browser,
  };
}

export async function registerCurrentDeviceSession(email?: string | null) {
  const device = getCurrentDeviceProfile();
  const { data, error } = await (supabase as any).rpc('register_current_device_session', {
    target_device_id: device.deviceId,
    target_device_name: device.deviceName,
    target_platform: device.platform,
    target_browser: device.browser,
    target_app_installation_id: device.appInstallationId,
    target_email: email ?? null,
  });

  if (error) throw error;
  return { ...(data as DeviceRegistrationResult), device } as DeviceRegistrationResult & { device: ReturnType<typeof getCurrentDeviceProfile> };
}

export async function sendDeviceVerificationOtp() {
  const device = getCurrentDeviceProfile();
  const { data, error } = await supabase.functions.invoke('send-device-verification-otp', {
    body: {
      deviceId: device.deviceId,
    },
  });

  if (error) throw error;
  return { ...(data as DeviceVerificationSendResult), device } as DeviceVerificationSendResult & { device: ReturnType<typeof getCurrentDeviceProfile> };
}

export async function verifyDeviceVerificationOtp(challengeId: string, otpCode: string) {
  const device = getCurrentDeviceProfile();
  const { data, error } = await (supabase as any).rpc('verify_device_verification_otp', {
    target_challenge_id: challengeId,
    submitted_code: otpCode,
    target_device_id: device.deviceId,
    target_device_name: device.deviceName,
    target_platform: device.platform,
    target_browser: device.browser,
    target_app_installation_id: device.appInstallationId,
  });

  if (error) throw error;
  return data as DeviceVerificationResult;
}

export async function listMyDeviceSessions() {
  const { data, error } = await (supabase as any)
    .from('device_sessions')
    .select('id, device_id, device_name, platform, browser, first_seen_at, last_seen_at, trusted_at, revoked_at, is_current')
    .order('last_seen_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DeviceSessionRow[];
}

export async function signOutOtherDeviceSessions() {
  const { data, error } = await (supabase as any).rpc('sign_out_other_device_sessions');
  if (error) throw error;
  return Number(data ?? 0);
}
