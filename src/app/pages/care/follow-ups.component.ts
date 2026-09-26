import { Component, OnInit, signal } from '@angular/core';
import {RouterLink} from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { doctorLabel, titleCase } from '../../utils/health-records';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent],
  selector: 'app-follow-ups',
  template: `
    <div class="wrap">
      <vos-back-button />
      <h1>Follow-ups</h1>
      <p class="lede">Rechecks from your vet and follow-up visits you’ve booked.</p>

      @if (error()) {
        <div class="vos-err">{{ error() }}</div>
      }
      @if (ok()) {
        <div class="vos-ok">{{ ok() }}</div>
      }

      @if (loading()) {
        <div class="vos-skel"></div>
      } @else if (!items().length) {
        <div class="empty">
          <div class="empty__mark" aria-hidden="true"></div>
          <h2>No open follow-ups</h2>
          <p>When your vet schedules a recheck — or you book a follow-up visit — it shows up here.</p>
          <a class="vos-btn" routerLink="/book/new" [queryParams]="{ reason: 'Follow-up' }">Book a follow-up</a>
        </div>
      } @else {
        @for (f of items(); track trackId(f)) {
          <article class="vos-card item">
            <div class="top">
              <span class="badge" [attr.data-kind]="f.kind">{{ kindLabel(f) }}</span>
              <span class="vos-muted">{{ statusLabel(f) }}</span>
            </div>
            <h2>{{ titleCase(f.petName) || 'Your pet' }} · {{ f.reason || 'Recheck' }}</h2>
            <p class="when">{{ prettyWhen(f) }}</p>
            @if (f.doctorName) {
              <p class="vos-muted">{{ doctorLabel(f.doctorName) }}</p>
            }
            @if (f.instructions) {
              <p>{{ f.instructions }}</p>
            }
            <div class="actions">
              @if (f.bookingId) {
                <a class="vos-btn" [routerLink]="['/bookings', f.bookingId]">Open booking</a>
              } @else if (f.visitId) {
                <a class="vos-btn" [routerLink]="['/visits', f.visitId]">View visit</a>
              } @else {
                <a
                  class="vos-btn"
                  routerLink="/book/new"
                  [queryParams]="{ petId: f.petId || null, reason: 'Follow-up' }"
                >
                  Book follow-up
                </a>
              }
              @if (f.id && !f._fromBooking && !f.customerAckAt) {
                <button type="button" class="vos-btn vos-btn-secondary" (click)="ack(f.id)">Acknowledge</button>
              }
            </div>
          </article>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .wrap {
      width: 100%;
      max-width: none;
      margin: 0;
    }
    h1, h2 { margin: 4px 0; font-family: var(--vos-display); }
    h1 {
      font-size: clamp(1.65rem, 3vw, 2.15rem);
      letter-spacing: -0.03em;
    }
    h2 { font-size: 1.15rem; }
    .lede {
      margin: 0 0 18px;
      color: var(--vos-ink-muted);
      max-width: 52ch;
    }
    .item {
      margin-bottom: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    .top {
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
      margin-bottom: 6px;
    }
    .badge {
      font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 8px;
      background: var(--vos-brand-soft); color: var(--vos-brand); text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge[data-kind='booking'] { background: #fff7e8; color: #8a5a12; }
    .when { margin: 4px 0 8px; font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .empty {
      text-align: center; padding: 36px 22px;
      border-radius: 20px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 44px; height: 44px; margin: 0 auto 10px; border-radius: 12px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin-bottom: 8px; }
    .empty p { margin: 0 auto 16px; max-width: 40ch; color: var(--vos-ink-muted); }
  `],
})
export class FollowUpsComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly ok = signal('');


  titleCase = titleCase;
  doctorLabel = doctorLabel;

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService
  ) {}

  ngOnInit() {
    void this.load();
  }

  trackId(f: any) {
    return f.id || f.bookingId || `${f.petId}-${f.dueAt}-${f.reason}`;
  }

  kindLabel(f: any) {
    return f.kind === 'booking' ? 'Booked visit' : 'Care plan';
  }

  statusLabel(f: any) {
    return String(f.status || f.customerStatus?.label || 'Open').replace(/_/g, ' ');
  }

  prettyWhen(f: any) {
    const due = f.dueAt || f.scheduledDate;
    const time = f.scheduledTime || '';
    if (!due) return time || 'Schedule TBD';
    const raw = String(due);
    const d = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return `${raw.slice(0, 10)}${time ? ` · ${time}` : ''}`;
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return time ? `${day} · ${time}` : day;
  }

  private isFollowUpBooking(b: any): boolean {
    const blob = [
      b?.reason,
      b?.bookingReason,
      b?.chiefComplaint,
      b?.category,
      b?.visitType,
      b?.type,
      b?.serviceType,
      b?.customerStatus?.label,
    ]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    return /follow[\s-]?up|recheck|followup/.test(blob);
  }

  private isOpenBooking(b: any): boolean {
    const s = String(b?.status || b?.customerStatus?.code || b?.customerStatus?.label || '').toLowerCase();
    if (/cancel|complet|closed|no.?show|missed|declined/.test(s)) return false;
    return true;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const petId = this.activePet.get();
      const [official, bookings] = await Promise.all([
        this.api.followUps(petId).catch(() => []),
        this.api.bookings().catch(() => []),
      ]);

      const fromApi = (official || []).map((f: any) => ({
        ...f,
        kind: 'care',
        petName: f.petName || f.pet?.name,
      }));

      const fromBookings = (bookings || [])
        .filter((b: any) => this.isFollowUpBooking(b) && this.isOpenBooking(b))
        .map((b: any) => ({
          id: `booking-${b.id}`,
          bookingId: b.id || b.displayId,
          petId: b.petId,
          petName: b.petName,
          reason: b.reason || b.bookingReason || 'Follow-up',
          dueAt: b.scheduledDate,
          scheduledDate: b.scheduledDate,
          scheduledTime: b.scheduledTime,
          doctorName: b.assignedDoctor || b.doctorName,
          status: b.customerStatus?.label || b.status || 'Scheduled',
          kind: 'booking',
          _fromBooking: true,
        }));

      // Dedupe: if official follow-up already references a booking, skip booking card
      const bookingIds = new Set(
        fromApi
          .map((f: any) => String(f.bookingId || f.relatedBookingId || ''))
          .filter(Boolean),
      );
      const merged = [
        ...fromApi,
        ...fromBookings.filter((b: any) => !bookingIds.has(String(b.bookingId))),
      ].sort((a: any, b: any) => {
        const da = new Date(a.dueAt || a.scheduledDate || 0).getTime() || 0;
        const db = new Date(b.dueAt || b.scheduledDate || 0).getTime() || 0;
        return da - db;
      });

      this.items.set(merged);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async ack(id: string) {
    this.error.set('');
    this.ok.set('');
    try {
      const res = await this.api.ackFollowUp(id);
      this.ok.set(res?.note || 'Acknowledged.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not acknowledge');
    }
  }
}
