import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentDeviceProfile, getOrCreateAppInstallationId } from '@/lib/deviceSessions';

describe('deviceSessions helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates and reuses a stable app installation id', () => {
    const first = getOrCreateAppInstallationId();
    const second = getOrCreateAppInstallationId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('derives a device profile from the browser context', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');

    const profile = getCurrentDeviceProfile();

    expect(profile.browser).toBe('Chrome');
    expect(profile.platform).toBe('MacIntel');
    expect(profile.deviceName).toContain('Chrome');
    expect(profile.deviceId).toBe(profile.appInstallationId);
  });
});
