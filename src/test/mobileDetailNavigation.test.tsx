import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMobileDetailNavigation } from '@/hooks/useMobileDetailNavigation';

const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalScrollTo = window.scrollTo;

function mockMobileViewport(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: originalRequestAnimationFrame,
  });
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: originalScrollTo });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('mobile document detail navigation', () => {
  it('opens a detail screen on mobile and restores the list position and focus on back', () => {
    mockMobileViewport(true);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
    const scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const selectDetail = vi.fn();
    const { result } = renderHook(() => useMobileDetailNavigation());

    act(() => result.current.openMobileDetail(selectDetail));

    expect(selectDetail).toHaveBeenCalledOnce();
    expect(result.current.mobileDetailOpen).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });

    act(() => result.current.closeMobileDetail());

    expect(result.current.mobileDetailOpen).toBe(false);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: 'auto' });
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the desktop split view without entering mobile detail mode', () => {
    mockMobileViewport(false);
    const selectDetail = vi.fn();
    const { result } = renderHook(() => useMobileDetailNavigation());

    act(() => result.current.openMobileDetail(selectDetail));

    expect(selectDetail).toHaveBeenCalledOnce();
    expect(result.current.mobileDetailOpen).toBe(false);
  });
});
