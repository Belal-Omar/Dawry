/**
 * Safe Meta (Facebook) Pixel helper.
 * Gracefully no-ops if fbq is blocked by ad-blockers or unavailable.
 */
export function trackMetaEvent(eventName, params = undefined) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      if (params && Object.keys(params).length > 0) {
        window.fbq('track', eventName, params);
      } else {
        window.fbq('track', eventName);
      }
    }
  } catch (e) {
    // Ignore tracking errors
  }
}

export function trackMetaPageView() {
  trackMetaEvent('PageView');
}
