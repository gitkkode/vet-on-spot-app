import { readAllPendingEdits } from './booking-pending';

const KEY = 'vos.notifications.local';

export type LocalNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read?: boolean;
  readAt?: string | null;
  entity?: string;
  entityId?: string;
  local: true;
};

function readAll(): LocalNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: LocalNotification[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function readLocalNotifications(): LocalNotification[] {
  return readAll();
}

export function unreadLocalNotificationCount(): number {
  return readAll().filter((n) => !n.read && !n.readAt).length;
}

/** Shown in Notifications until the server sends its own cancel alert. */
export function rememberCancelNotification(opts: {
  bookingId: string;
  petName?: string;
  displayId?: string;
}): LocalNotification {
  const bookingId = String(opts.bookingId || '').trim();
  const id = `local-cancel-${bookingId || Date.now()}`;
  const existing = readAll().find((n) => n.id === id);
  if (existing) return existing;
  const items = readAll();
  const who = String(opts.petName || '').trim();
  const ref = String(opts.displayId || '').trim();
  const subject = ref || 'Your visit';
  const note: LocalNotification = {
    id,
    title: 'Appointment cancelled',
    body: who
      ? `${subject} for ${who} was cancelled. You can book again anytime.`
      : `${subject} was cancelled. You can book again anytime.`,
    createdAt: new Date().toISOString(),
    read: false,
    readAt: null,
    entity: 'booking',
    entityId: bookingId,
    local: true,
  };
  writeAll([note, ...items]);
  return note;
}

/** Backfill a notice for cancels already stored on this device. */
export function syncCancelNotificationsFromPending() {
  const pending = readAllPendingEdits();
  for (const [id, edit] of Object.entries(pending)) {
    if (!edit?.hideFromUpcoming) continue;
    if (edit.kind === 'reschedule' || edit.replacementId) continue;
    rememberCancelNotification({ bookingId: id });
  }
}

export function markLocalNotificationsRead(ids: string[]) {
  const want = new Set((ids || []).map(String));
  if (!want.size) return;
  const now = new Date().toISOString();
  writeAll(
    readAll().map((n) => (want.has(n.id) ? { ...n, read: true, readAt: now } : n)),
  );
}
