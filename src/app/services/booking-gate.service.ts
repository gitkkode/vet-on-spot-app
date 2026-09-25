import { Injectable, computed, signal } from '@angular/core';
import { ActivePetService } from './active-pet.service';
import { CustomerApiService } from './customer-api.service';
import { filterUpcomingBookings, normalizeBookingsList } from '../utils/booking-pending';

/**
 * Tracks every pet that already has an upcoming / ongoing visit so Book CTAs
 * stay disabled for that pet everywhere in the app.
 */
@Injectable({ providedIn: 'root' })
export class BookingGateService {
  private readonly blockedPetIds = signal<Set<string>>(new Set());
  private readonly blockedPetNames = signal<Set<string>>(new Set());
  /** Explicit “has visit” marks from pet-scoped home — only add, never wipe API blocks. */
  private readonly stickyBlockedIds = signal<Set<string>>(new Set());
  private readonly stickyBlockedNames = signal<Set<string>>(new Set());
  private readonly petNameById = signal<Map<string, string>>(new Map());
  private refreshSeq = 0;

  readonly blockedForActivePet = computed(() => {
    const id = this.activePet.activePetId();
    const name = id ? this.petNameById().get(id) : undefined;
    return this.isBlocked(id, name);
  });

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
  ) {}

  isBlocked(petId?: string | null, petName?: string | null): boolean {
    const id = String(petId || '').trim();
    if (id && (this.blockedPetIds().has(id) || this.stickyBlockedIds().has(id))) return true;
    const name = this.normName(petName);
    if (name && (this.blockedPetNames().has(name) || this.stickyBlockedNames().has(name))) {
      return true;
    }
    return false;
  }

  syncFromBookings(raw: unknown, pets: Array<{ id?: string; name?: string }> = []) {
    const list = filterUpcomingBookings(normalizeBookingsList(raw)).filter(
      (b) => this.isActiveBooking(b) && this.isUpcomingSlot(b),
    );
    const ids = new Set<string>();
    const names = new Set<string>();
    const idsByName = new Map<string, string[]>();
    const nameById = new Map<string, string>();

    for (const p of pets || []) {
      const pid = String(p?.id || '').trim();
      const n = this.normName(p?.name);
      if (!pid || !n) continue;
      nameById.set(pid, n);
      const arr = idsByName.get(n) || [];
      arr.push(pid);
      idsByName.set(n, arr);
    }
    this.petNameById.set(nameById);

    for (const b of list) {
      const fromIds = this.petIdsOnBooking(b);
      for (const pid of fromIds) {
        ids.add(pid);
        const pet = (pets || []).find((p) => String(p?.id || '') === pid);
        const n = this.normName(pet?.name || b?.petName);
        if (n && !this.isGenericPetName(n)) names.add(n);
      }

      const bookingName = this.normName(b?.petName);
      if (bookingName && !this.isGenericPetName(bookingName)) {
        names.add(bookingName);
        // Same display name can exist on multiple pet profiles — block all of them
        for (const pid of idsByName.get(bookingName) || []) ids.add(pid);
      }

      // Booking has petId(s) but also name — ensure name is blocked too
      if (!fromIds.length && (!bookingName || this.isGenericPetName(bookingName))) {
        // Orphan / generic — cannot map; leave for sticky from home
      }
    }

    for (const id of this.stickyBlockedIds()) ids.add(id);
    for (const n of this.stickyBlockedNames()) names.add(n);

    this.blockedPetIds.set(ids);
    this.blockedPetNames.set(names);
  }

  /**
   * Mark a pet as blocked from pet-scoped home data.
   * Only adds blocks — never clears API-inferred blocks for other pets.
   */
  markPetBlocked(petId: string | null | undefined, petName?: string | null) {
    const id = String(petId || '').trim();
    const name = this.normName(petName);

    if (id) {
      this.stickyBlockedIds.update((prev) => new Set(prev).add(id));
      this.blockedPetIds.update((prev) => new Set(prev).add(id));
    }
    if (name && !this.isGenericPetName(name)) {
      this.stickyBlockedNames.update((prev) => new Set(prev).add(name));
      this.blockedPetNames.update((prev) => new Set(prev).add(name));
    }
  }

  /** Clear block after a successful cancel for this pet. */
  clearPetBlocked(petId: string | null | undefined, petName?: string | null) {
    const id = String(petId || '').trim();
    const name = this.normName(petName);

    if (id) {
      this.stickyBlockedIds.update((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      this.blockedPetIds.update((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    if (name) {
      this.stickyBlockedNames.update((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      this.blockedPetNames.update((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  /** @deprecated use markPetBlocked / clearPetBlocked */
  setPetBlocked(
    petId: string | null | undefined,
    blocked: boolean,
    petName?: string | null,
  ) {
    if (blocked) this.markPetBlocked(petId, petName);
    else this.clearPetBlocked(petId, petName);
  }

  async refresh(): Promise<void> {
    const seq = ++this.refreshSeq;
    try {
      const [bookings, pets] = await Promise.all([
        this.api.bookings(),
        this.api.pets().catch(() => [] as any[]),
      ]);
      if (seq !== this.refreshSeq) return;
      this.syncFromBookings(bookings, pets || []);
    } catch {
      /* keep last known state */
    }
  }

  private petIdsOnBooking(b: any): string[] {
    const out: string[] = [];
    const single = String(b?.petId || b?.pet?.id || '').trim();
    if (single) out.push(single);
    if (Array.isArray(b?.petIds)) {
      for (const x of b.petIds) {
        const id = String(x || '').trim();
        if (id) out.push(id);
      }
    }
    return out;
  }

  private isActiveBooking(b: any): boolean {
    const st = String(b?.status || b?.customerStatus?.code || b?.customerStatus?.label || '').toLowerCase();
    if (!st) return true;
    return !/(complet|cancel|done|no.?show|closed|declined|missed)/.test(st);
  }

  private isUpcomingSlot(b: any): boolean {
    const when = b?.scheduledDate || b?.preferredDate;
    if (!when) return true;
    const raw = String(when);
    const t = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`).getTime();
    return Number.isNaN(t) || t >= Date.now() - 4 * 3600 * 1000;
  }

  private normName(name: string | null | undefined): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private isGenericPetName(name: string): boolean {
    return name === 'visit' || name === 'pet' || name === 'your pet' || name === 'home visit';
  }
}
