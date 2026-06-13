import { useCallback, useEffect, useRef, useState } from 'react';

interface AutoRefreshState {
  countdown: number;      // seconds until next refresh
  isRefreshing: boolean;  // true during the async callback
  triggerNow: () => void; // manual fire + reset countdown
}

/**
 * Polls `callback` on a fixed interval and returns a live countdown.
 * The countdown resets to `intervalSec` after each refresh (manual or auto).
 * Pauses automatically while the tab is hidden to avoid wasted requests.
 */
export function useAutoRefresh(
  callback: () => Promise<unknown>,
  intervalSec: number,
): AutoRefreshState {
  const [countdown, setCountdown] = useState(intervalSec);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const remainingRef = useRef(intervalSec);
  const callbackRef  = useRef(callback);
  callbackRef.current = callback;

  const fire = useCallback(async () => {
    remainingRef.current = intervalSec;
    setCountdown(intervalSec);
    setIsRefreshing(true);
    try {
      await callbackRef.current();
    } finally {
      setIsRefreshing(false);
    }
  }, [intervalSec]);

  // 1-second tick; skip while tab hidden
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      remainingRef.current -= 1;
      setCountdown(remainingRef.current);
      if (remainingRef.current <= 0) {
        void fire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [fire]);

  // Reset countdown whenever intervalSec changes
  useEffect(() => {
    remainingRef.current = intervalSec;
    setCountdown(intervalSec);
  }, [intervalSec]);

  return { countdown, isRefreshing, triggerNow: fire };
}
