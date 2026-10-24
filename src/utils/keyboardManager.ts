/**
 * Global Mobile Keyboard Visibility Manager
 * Ensures that whenever the user focuses ANY <input> or <textarea> across the app
 * (Chat input, Pending verification table, Dashboard edit/search, Settings, Login),
 * the container resizes above the virtual keyboard and scrolls the active field into view.
 */

let maxObservedHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

function isTextEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    const nonKeyboardTypes = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'];
    return !nonKeyboardTypes.includes(type);
  }
  if (el.isContentEditable) return true;
  return false;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
}

export function initGlobalKeyboardManager(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  maxObservedHeight = Math.max(maxObservedHeight, window.innerHeight);

  const root = document.documentElement;
  let timers: number[] = [];

  const clearTimers = () => {
    timers.forEach(t => window.clearTimeout(t));
    timers = [];
  };

  const scrollActiveInputIntoView = (el: HTMLElement) => {
    try {
      // Do not scroll the main chat bottom bar itself out of its flex footer; only scroll inner form inputs
      if (el.dataset.chatMainInput === 'true') {
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch {}
  };

  const updateViewportMetrics = () => {
    const innerH = window.innerHeight;
    if (innerH > maxObservedHeight) {
      maxObservedHeight = innerH;
    }

    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : innerH;
    const vvOffsetTop = vv ? vv.offsetTop : 0;

    const activeEl = document.activeElement;
    const inputFocused = isMobileDevice() && isTextEditableElement(activeEl);

    // Check if either window.innerHeight or visualViewport.height shrank significantly (> 100px)
    const totalShrink = maxObservedHeight - vvHeight;
    const fixedElementOverlap = Math.max(0, innerH - vvHeight - vvOffsetTop);

    if (inputFocused) {
      if (totalShrink > 100) {
        // Case 1: OS / WebView properly shrank either innerHeight (v1.7 APK) or visualViewport (Chrome/Safari)
        root.style.setProperty('--vv-height', `${Math.round(vvHeight)}px`);
        root.style.setProperty('--kb-offset', `${Math.round(fixedElementOverlap)}px`);
        root.classList.add('hk-kb-active');
      } else {
        // Case 2: Older Android WebView swallowed IME insets so neither innerHeight nor visualViewport shrank.
        // Estimate mobile keyboard height (~40% of screen, clamped between 260px and 340px) so input is never hidden!
        const estimatedKbHeight = Math.min(340, Math.max(260, Math.round(innerH * 0.41)));
        const visibleHeight = innerH - estimatedKbHeight;
        root.style.setProperty('--vv-height', `${visibleHeight}px`);
        root.style.setProperty('--kb-offset', `${estimatedKbHeight}px`);
        root.classList.add('hk-kb-active');
      }

      if (activeEl instanceof HTMLElement) {
        scrollActiveInputIntoView(activeEl);
      }
    } else {
      root.style.setProperty('--vv-height', `${innerH}px`);
      root.style.setProperty('--kb-offset', '0px');
      root.classList.remove('hk-kb-active');
    }
  };

  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as Element | null;
    if (!isMobileDevice() || !isTextEditableElement(target)) return;

    clearTimers();
    updateViewportMetrics();

    // Re-check at 120ms, 260ms, and 450ms as the mobile soft keyboard animates up
    [120, 260, 450].forEach(delay => {
      const id = window.setTimeout(() => {
        updateViewportMetrics();
      }, delay);
      timers.push(id);
    });
  };

  const handleFocusOut = () => {
    clearTimers();
    const id = window.setTimeout(() => {
      if (!isTextEditableElement(document.activeElement)) {
        root.style.setProperty('--vv-height', `${window.innerHeight}px`);
        root.style.setProperty('--kb-offset', '0px');
        root.classList.remove('hk-kb-active');
      } else {
        updateViewportMetrics();
      }
    }, 100);
    timers.push(id);
  };

  updateViewportMetrics();

  window.addEventListener('resize', updateViewportMetrics);
  window.visualViewport?.addEventListener('resize', updateViewportMetrics);
  window.visualViewport?.addEventListener('scroll', updateViewportMetrics);
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);

  return () => {
    clearTimers();
    window.removeEventListener('resize', updateViewportMetrics);
    window.visualViewport?.removeEventListener('resize', updateViewportMetrics);
    window.visualViewport?.removeEventListener('scroll', updateViewportMetrics);
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('focusout', handleFocusOut, true);
  };
}
