import { useCallback, useRef, useState } from 'react';

const MOBILE_DETAIL_QUERY = '(max-width: 767px)';

function isMobileDetailViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_DETAIL_QUERY).matches;
}

export function useMobileDetailNavigation() {
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const listScrollPosition = useRef(0);
  const listTrigger = useRef<HTMLElement | null>(null);

  const openMobileDetail = useCallback((selectDetail: () => void) => {
    selectDetail();
    if (!isMobileDetailViewport()) return;

    listScrollPosition.current = window.scrollY;
    listTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMobileDetailOpen(true);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  }, []);

  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: listScrollPosition.current, behavior: 'auto' });
      listTrigger.current?.focus({ preventScroll: true });
    });
  }, []);

  const resetMobileDetail = useCallback(() => setMobileDetailOpen(false), []);

  return { mobileDetailOpen, openMobileDetail, closeMobileDetail, resetMobileDetail };
}
