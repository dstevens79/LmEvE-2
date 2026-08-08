import { useEffect } from 'react';

/**
 * Logs the user out after continuous inactivity when session timeout is enabled.
 */
export function useInactivityLogout(
  enabled: boolean | undefined,
  timeoutMinutes: number | undefined,
  logout: () => void
): void {
  useEffect(() => {
    if (!enabled) return;
    const minutes = Math.max(5, Math.min(480, timeoutMinutes || 60));
    const timeoutMs = minutes * 60 * 1000;
    let lastActivity = Date.now();
    let timer: number | undefined;

    const resetTimer = () => {
      lastActivity = Date.now();
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (Date.now() - lastActivity >= timeoutMs) {
          try {
            console.log('Inactivity timeout reached - logging out');
          } catch {
            /* ignore */
          }
          logout();
        }
      }, timeoutMs + 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [enabled, timeoutMinutes, logout]);
}
