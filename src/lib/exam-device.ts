/**
 * Whether this browser should run the exam fullscreen gate.
 *
 * Phones and small touch devices get unreliable fullscreen (browser chrome,
 * notches, OS gestures) and false warnings. They sit the exam windowed;
 * leaving the page still counts via visibilitychange.
 *
 * Desktops and laptops keep the fullscreen start gate and grace window.
 */
export function examSupportsFullscreen(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  if (
    !document.fullscreenEnabled ||
    typeof document.documentElement.requestFullscreen !== 'function'
  ) {
    return false
  }

  const ua = navigator.userAgent
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return false
  // iPadOS 13+ reports as Macintosh but is a touch tablet.
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return false

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.matchMedia('(max-width: 900px)').matches
  if (coarse && narrow) return false

  return true
}
