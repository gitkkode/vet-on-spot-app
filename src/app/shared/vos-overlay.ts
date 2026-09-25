/** Dispatched when a VOS overlay (select / date picker) opens so siblings can close. */
export const VOS_OVERLAY_OPEN = 'vos-overlay-open';

export function announceVosOverlayOpen(source: object): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent(VOS_OVERLAY_OPEN, { detail: source }));
}
