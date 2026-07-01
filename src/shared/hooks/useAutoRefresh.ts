import { useCallback, useEffect, useRef, useState } from 'react';

interface AutoRefreshState {
  countdown: number;      // seconds until next refresh
  isRefreshing: boolean;  // true during the async callback
  triggerNow: () => void; // manual fire + reset countdown
}

/**
 * Polls `callback` on a fixed interval and returns a live countdown.
 * The countdown resets to `intervalSec` after each refresh (manual or auto).
 *
 * Visibility-aware: the 1-second tick interval is cleared entirely when the
 * tab is hidden and restarted when it becomes visible again. This avoids
 * wasting CPU/battery on a timer that was already skipping its callback.
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

  // Start/stop the 1-second tick based on tab visibility.
  // Clearing the interval completely (not just skipping) saves CPU/battery on
  // background tabs — especially important on mobile devices.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const startTick = () => {
      if (id !== null) return;
      id = setInterval(() => {
        remainingRef.current -= 1;
        setCountdown(remainingRef.current);
        if (remainingRef.current <= 0) void fire();
      }, 1000);
    };

    const stopTick = () => {
      if (id !== null) { clearInterval(id); id = null; }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopTick();
      } else {
        // Resume with a reset countdown so we don't immediately fire on return.
        remainingRef.current = intervalSec;
        setCountdown(intervalSec);
        startTick();
      }
    };

    if (!document.hidden) startTick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopTick();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fire, intervalSec]);

  // Reset countdown whenever intervalSec changes.
  useEffect(() => {
    remainingRef.current = intervalSec;
    setCountdown(intervalSec);
  }, [intervalSec]);

  return { countdown, isRefreshing, triggerNow: fire };
}
