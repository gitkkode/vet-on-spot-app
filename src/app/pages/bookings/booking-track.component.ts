import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-booking-track',
  template: `
    <a [routerLink]="['/bookings', id]" class="vos-back">
      <span class="vos-back__chev" aria-hidden="true">‹</span>
      Appointment
    </a>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }

    @if (loading()) {
      <div class="vos-skel vos-skel--gloss title-skel"></div>
      <div class="vos-skel vos-skel--gloss" style="height: 220px; border-radius: 22px"></div>
      <div class="vos-skel vos-skel--gloss" style="height: 96px; border-radius: 18px"></div>
    } @else if (data(); as d) {
      <header class="head">
        <p class="head__kicker">Live tracking</p>
        <h1>Track visit</h1>
        <span class="status">
          <span class="status__dot" aria-hidden="true"></span>
          {{ d.customerStatus?.label || d.booking?.status || 'Updating' }}
        </span>
        @if (d.customerStatus?.detail) {
          <p class="head__detail">{{ d.customerStatus.detail }}</p>
        }
      </header>

      <section class="rail-card" aria-label="Visit progress">
        <ol class="rail">
          @for (s of d.steps || []; track s.code; let i = $index; let last = $last) {
            <li [class]="'rail__item rail__item--' + (s.state || 'todo')">
              <span class="rail__mark" aria-hidden="true">
                @if (s.state === 'done') { ✓ } @else if (s.state === 'current') { ● } @else { {{ i + 1 }} }
              </span>
              @if (!last) {
                <span class="rail__line" aria-hidden="true"></span>
              }
              <div class="rail__body">
                <strong>{{ s.label }}</strong>
                @if (s.state === 'current' && s.detail) {
                  <span>{{ s.detail }}</span>
                }
              </div>
            </li>
          }
        </ol>
      </section>

      <article class="summary">
        <div class="summary__row">
          <em>Pet</em>
          <strong>{{ d.booking?.petName || 'Your pet' }}</strong>
        </div>
        <div class="summary__row">
          <em>When</em>
          <strong>{{ prettyWhen(d.booking) }}</strong>
        </div>
        <div class="summary__row">
          <em>Doctor</em>
          <strong>{{ d.booking?.assignedDoctor || 'Assignment pending' }}</strong>
        </div>
        <div class="summary__row">
          <em>Pay</em>
          <strong class="pay">Pay later · when the vet arrives</strong>
        </div>
      </article>

      <button type="button" class="refresh" (click)="load()" [disabled]="loading()">
        Refresh status
      </button>
    }
  `,
  styles: [`
    :host { display: block; font-family: var(--vos-font); }

    .linkish {
      border: 0; background: none; color: inherit; font-weight: 700;
      cursor: pointer; text-decoration: underline;
    }
    .title-skel { height: 88px; border-radius: 18px; margin-bottom: 14px; }

    .head { margin-bottom: 18px; animation: rise 0.4s ease both; }
    .head__kicker {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 600;
    }
    .head h1 {
      margin: 0 0 12px;
      font-family: var(--vos-display);
      font-size: clamp(1.85rem, 4vw, 2.4rem);
      letter-spacing: -0.04em;
      line-height: 1.05;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 4px 12px 4px 10px;
      border-radius: 999px;
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
      font-weight: 700;
      font-size: 0.9rem;
    }
    .status__dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--vos-brand);
      box-shadow: 0 0 0 0 rgba(253, 74, 41, 0.35);
      animation: pulse 1.8s ease-out infinite;
    }
    .head__detail {
      margin: 12px 0 0;
      color: var(--vos-ink-muted);
      font-size: 1.02rem;
      line-height: 1.45;
      max-width: 42ch;
    }

    .rail-card {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 8px 18px 8px 16px;
      box-shadow: 0 12px 32px rgba(10, 10, 10, 0.05);
      margin-bottom: 14px;
    }
    .rail {
      list-style: none;
      margin: 0;
      padding: 8px 0;
    }
    .rail__item {
      position: relative;
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 12px;
      padding: 12px 0 16px;
      color: var(--vos-ink-muted);
    }
    .rail__mark {
      position: relative;
      z-index: 1;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      font-family: var(--vos-mono);
      background: #f3efe6;
      color: #8a8680;
      border: 1px solid var(--vos-border);
    }
    .rail__line {
      position: absolute;
      left: 13px;
      top: 40px;
      bottom: 0;
      width: 2px;
      background: var(--vos-border);
    }
    .rail__body strong {
      display: block;
      font-family: var(--vos-display);
      font-size: 1.02rem;
      letter-spacing: -0.02em;
      color: inherit;
      font-weight: 700;
    }
    .rail__body span {
      display: block;
      margin-top: 4px;
      font-size: 0.92rem;
      line-height: 1.35;
    }
    .rail__item--done { color: var(--vos-ink); }
    .rail__item--done .rail__mark {
      background: #ecfdf3;
      border-color: #86efac;
      color: #166534;
    }
    .rail__item--done .rail__line { background: #86efac; }
    .rail__item--current { color: var(--vos-brand); }
    .rail__item--current .rail__mark {
      background: linear-gradient(145deg, #FD4A29, #E03E20);
      border-color: transparent;
      color: #fff;
      box-shadow: 0 6px 16px rgba(253, 74, 41, 0.35);
      font-size: 9px;
    }
    .rail__item--current .rail__body span { color: var(--vos-ink-muted); font-weight: 500; }

    .summary {
      background: #fffef9;
      border: 1px solid var(--vos-border);
      border-radius: 20px;
      padding: 6px 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 22px rgba(10, 10, 10, 0.04);
    }
    .summary__row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: baseline;
      padding: 14px 0;
      border-bottom: 1px solid rgba(217, 212, 200, 0.7);
    }
    .summary__row:last-child { border-bottom: 0; }
    .summary__row em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
      flex-shrink: 0;
    }
    .summary__row strong {
      text-align: right;
      font-family: var(--vos-display);
      font-size: 1.02rem;
      letter-spacing: -0.02em;
      font-weight: 700;
    }
    .pay { color: var(--vos-brand); }

    .refresh {
      width: 100%;
      min-height: 48px;
      border-radius: 999px;
      border: 1px solid var(--vos-border);
      background: #fff;
      color: var(--vos-ink);
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(10, 10, 10, 0.04);
    }
    .refresh:hover { border-color: rgba(253, 74, 41, 0.35); color: var(--vos-brand); }
    .refresh:disabled { opacity: 0.6; cursor: wait; }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(253, 74, 41, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(253, 74, 41, 0); }
      100% { box-shadow: 0 0 0 0 rgba(253, 74, 41, 0); }
    }
  `],
})
export class BookingTrackComponent implements OnInit {
  id = '';
  readonly data = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  prettyWhen(booking: any): string {
    if (!booking) return '—';
    const date = booking.scheduledDate || '';
    const time = booking.scheduledTime || '';
    if (!date && !time) return '—';
    let pretty = date;
    if (date) {
      const d = new Date(date.includes('T') ? date : `${date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        pretty = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
    }
    return time ? `${pretty} · ${time}` : pretty;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.bookingJourney(this.id));
    } catch (e: any) {
      this.error.set(e?.message || 'Could not load journey');
    } finally {
      this.loading.set(false);
    }
  }
}
