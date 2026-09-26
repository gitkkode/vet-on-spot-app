/** Local pending booking edits — used when API update is unavailable or still propagating. */

export const PENDING_BOOKING_EDITS_KEY = 'vos.booking.pendingEdits';

export type PendingBookingEdit = {
  preferredDate: string;
  preferredTime: string;
  address: string;
  reasonForVisit: string;
  requestedAt: string;
  /** Support ticket id shown to admin / customer. */
  ticketId?: string;
  /** If we created a replacement booking, point lists at it. */
  replacementId?: string;
  /** Hide this booking from Upcoming (superseded / cancelled locally). */
  hideFromUpcoming?: boolean;
  /** Inject into lists until the API returns the new booking. */
  synthetic?: {
    id: string;
    petId?: string;
    petName?: string;
    consultationType?: string;
    status?: string;
  };
};

export function readAllPendingEdits(): Record<string, PendingBookingEdit> {
  try {
    const raw = localStorage.getItem(PENDING_BOOKING_EDITS_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw);
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

export function readPendingEdit(bookingId: string): PendingBookingEdit | null {
  const id = String(bookingId || '').trim();
  if (!id) return null;
  return readAllPendingEdits()[id] || null;
}

export function writePendingEdit(bookingId: string, edit: PendingBookingEdit): void {
  const id = String(bookingId || '').trim();
  if (!id) return;
  try {
    const map = readAllPendingEdits();
    map[id] = edit;
    localStorage.setItem(PENDING_BOOKING_EDITS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function clearPendingEdit(bookingId: string): void {
  const id = String(bookingId || '').trim();
  if (!id) return;
  try {
    const map = readAllPendingEdits();
    delete map[id];
    localStorage.setItem(PENDING_BOOKING_EDITS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Mark an old visit as replaced so Upcoming drops it once the new one exists. */
export function markBookingSuperseded(
  oldId: string,
  replacementId: string,
  edit: {
    preferredDate: string;
    preferredTime: string;
    address: string;
    reasonForVisit: string;
    requestedAt: string;
    petId?: string;
    petName?: string;
    consultationType?: string;
  },
): void {
  const { petId, petName, consultationType, ...slot } = edit;
  writePendingEdit(oldId, {
    ...slot,
    replacementId,
    hideFromUpcoming: true,
  });
  writePendingEdit(replacementId, {
    ...slot,
    synthetic: {
      id: replacementId,
      petId,
      petName,
      consultationType,
      status: 'scheduled',
    },
  });
}

/** Normalize bookings list payloads from the API. */
export function normalizeBookingsList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of ['bookings', 'items', 'data', 'upcoming', 'results']) {
      if (Array.isArray(obj[k])) return obj[k] as any[];
    }
  }
  return [];
}

/** Merge a pending edit into a booking so UI (lists, detail) shows the new slot. */
export function applyPendingEditToBooking(booking: any): any {
  if (!booking) return booking;
  const id = String(booking.id || booking.displayId || '').trim();
  const pending = readPendingEdit(id);
  if (!pending) return booking;
  if (pending.hideFromUpcoming) {
    return {
      ...booking,
      status: 'cancelled',
      customerStatus: {
        ...(booking.customerStatus || {}),
        label: 'Rescheduled',
        code: 'cancelled',
        detail: pending.replacementId
          ? `Moved to ${pending.replacementId}`
          : 'Superseded by a newer booking',
      },
      _pendingEdit: true,
      _superseded: true,
      _replacementId: pending.replacementId || null,
    };
  }

  return {
    ...booking,
    preferredDate: pending.preferredDate,
    preferredTime: pending.preferredTime,
    scheduledDate: pending.preferredDate,
    scheduledTime: pending.preferredTime,
    location: pending.address,
    address: pending.address,
    reason: pending.reasonForVisit,
    reasonForVisit: pending.reasonForVisit,
    // Force active so Upcoming still shows after cancel-then-pending
    status: 'scheduled',
    customerStatus: {
      ...(booking.customerStatus || {}),
      label: 'Scheduled',
      code: 'scheduled',
      detail: 'Updated slot — waiting for confirmation',
    },
    _pendingEdit: true,
  };
}

/**
 * Apply pending edits, drop superseded duplicates from upcoming views,
 * and inject synthetic replacement bookings until the API returns them.
 */
export function applyPendingEditsToList(list: any[]): any[] {
  const source = normalizeBookingsList(list);
  const pending = readAllPendingEdits();
  const byId = new Map<string, any>();

  for (const b of source) {
    const id = String(b?.id || b?.displayId || '').trim();
    if (!id) continue;
    byId.set(id, applyPendingEditToBooking(b));
  }

  // Inject synthetics for replacements not yet returned by the API
  for (const [id, edit] of Object.entries(pending)) {
    if (!edit?.synthetic?.id && !edit) continue;
    if (byId.has(id)) continue;
    if (edit.hideFromUpcoming) continue;
    if (!edit.preferredDate || !edit.preferredTime) continue;

    const syn = edit.synthetic || { id };
    byId.set(id, {
      id,
      petId: syn.petId,
      petName: syn.petName || 'Visit',
      preferredDate: edit.preferredDate,
      preferredTime: edit.preferredTime,
      scheduledDate: edit.preferredDate,
      scheduledTime: edit.preferredTime,
      location: edit.address,
      address: edit.address,
      reason: edit.reasonForVisit,
      reasonForVisit: edit.reasonForVisit,
      consultationType: syn.consultationType || 'Home Visit',
      status: syn.status || 'scheduled',
      customerStatus: {
        label: 'Scheduled',
        code: 'scheduled',
        detail: 'Rescheduled visit',
      },
      _pendingEdit: true,
      _synthetic: true,
    });
  }

  // Clear pending once the live booking already matches the saved slot
  for (const [id, b] of byId) {
    const edit = pending[id];
    if (!edit || edit.hideFromUpcoming || b._synthetic) continue;
    const date = String(b.scheduledDate || b.preferredDate || '').slice(0, 10);
    const time = String(b.scheduledTime || b.preferredTime || '').trim();
    if (date === edit.preferredDate && time === edit.preferredTime) {
      // Keep briefly so UI stays stable; clear after confirmed match without pending banner need
      if (!edit.synthetic) {
        /* leave edit for detail banner until user opens detail */
      }
    }
  }

  return Array.from(byId.values());
}

/** Upcoming-friendly list: hide superseded / cancelled-by-reschedule entries. */
export function filterUpcomingBookings(list: any[]): any[] {
  return applyPendingEditsToList(list).filter((b) => !b?._superseded);
}

/** Booking is not completed / cancelled / closed. */
export function isActiveBookingStatus(b: any): boolean {
  const st = String(b?.status || b?.customerStatus?.code || b?.customerStatus?.label || '').toLowerCase();
  if (!st) return true;
  return !/(complet|cancel|done|no.?show|closed|declined|missed|void)/.test(st);
}

/**
 * True for upcoming or recently-started slots (ongoing today).
 * Past dates (older than ~4h) do not block new bookings.
 */
export function isUpcomingOrOngoingSlot(b: any): boolean {
  const when = b?.scheduledDate || b?.preferredDate;
  if (!when) return true;
  const raw = String(when);
  const t = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`).getTime();
  return Number.isNaN(t) || t >= Date.now() - 4 * 3600 * 1000;
}

/** Pet ids attached to a booking (single + multi-pet). */
export function bookingPetIds(b: any): string[] {
  const out: string[] = [];
  const single = String(b?.petId || b?.pet?.id || '').trim();
  if (single) out.push(single);
  if (Array.isArray(b?.petIds)) {
    for (const x of b.petIds) {
      const id = String(x || '').trim();
      if (id && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function normalizePetName(name: string | null | undefined): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isGenericPetName(name: string): boolean {
  const n = normalizePetName(name);
  return !n || n === 'visit' || n === 'pet' || n === 'your pet' || n === 'home visit';
}

/** Bookings that should block a new visit for a pet. */
export function blockingBookings(raw: unknown): any[] {
  return filterUpcomingBookings(normalizeBookingsList(raw)).filter(
    (b) => isActiveBookingStatus(b) && isUpcomingOrOngoingSlot(b),
  );
}

/**
 * Whether a booking blocks this pet.
 * Prefer petId / petIds. Fall back to name only when the booking has no pet id.
 */
export function bookingBlocksPet(
  b: any,
  petId?: string | null,
  petName?: string | null,
): boolean {
  const id = String(petId || '').trim();
  const ids = bookingPetIds(b);
  if (id && ids.includes(id)) return true;
  if (ids.length) return false; // booking is tied to other pet(s) only
  const name = normalizePetName(petName);
  const bName = normalizePetName(b?.petName || b?.pet?.name);
  if (!name || !bName || isGenericPetName(bName)) return false;
  return name === bName;
}

