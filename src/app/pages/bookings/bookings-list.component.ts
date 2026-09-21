import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

type FilterTab = 'upcoming' | 'past' | 'all';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-bookings-list',
  template: `
    <header class="head">
      <div>
        <p class="kicker">Your care timeline</p>
        <h1>Appointments</h1>
        <p class="lede">Every home visit in one place — upcoming first, history when you need it.</p>
      </div>
      <a class="book" routerLink="/book/new">Book visit</a>
    </header>

    @if (error()) {
      <div class="vos-err">
        {{ error() }}
        <button type="button" class="linkish" (click)="load()">Try again</button>
      </div>
    }

    @if (loading()) {
      <div class="vos-skel hero-skel"></div>
      <div class="vos-skel"></div>
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <div class="empty">
        <p class="empty__kicker">Fresh start</p>
        <h2>No visits yet</h2>
        <p>Book a home visit when something feels off — or just for a checkup.</p>
        <a class="book book--lg" routerLink="/book/new">Book a visit</a>
      </div>
    } @else {
      @if (nextUp(); as next) {
        <a class="hero" [routerLink]="['/bookings', next.id]">
          <div class="hero__glow" aria-hidden="true"></div>
          <p class="hero__kicker">Up next</p>
          <strong class="hero__title">{{ next.petName || 'Your pet' }}’s visit</strong>
          <p class="hero__detail">
            {{ next.customerStatus?.label || next.status || 'Scheduled' }}
            · {{ prettyWhen(next.scheduledDate, next.scheduledTime) }}
          </p>
          <span class="hero__cta">Open visit →</span>
        </a>
      }

      <div class="tabs" role="tablist" aria-label="Filter appointments">
        <button type="button" role="tab" [class.on]="tab() === 'upcoming'" [attr.aria-selected]="tab() === 'upcoming'" (click)="tab.set('upcoming')">
          Upcoming
          <em>{{ upcoming().length }}</em>
        </button>
        <button type="button" role="tab" [class.on]="tab() === 'past'" [attr.aria-selected]="tab() === 'past'" (click)="tab.set('past')">
          Past
          <em>{{ past().length }}</em>
        </button>
        <button type="button" role="tab" [class.on]="tab() === 'all'" [attr.aria-selected]="tab() === 'all'" (click)="tab.set('all')">
          All
          <em>{{ items().length }}</em>
        </button>
      </div>

      @if (!filtered().length) {
        <div class="quiet">
          @if (tab() === 'upcoming') {
            <p>Nothing upcoming — book when you’re ready.</p>
            <a routerLink="/book/new">Book a visit</a>
          } @else {
            <p>No past visits in this view yet.</p>
          }
        </div>
      } @else {
        <div class="timeline" aria-label="Appointment list">
          @for (group of grouped(); track group.key) {
            <section class="group">
              <h2 class="group__label">{{ group.label }}</h2>
              <div class="list">
                @for (b of group.items; track b.id) {
                  <a class="card" [routerLink]="['/bookings', b.id]" [class.card--live]="isLive(b)">
                    <div class="card__rail" aria-hidden="true">
                      <span class="card__dot" [class.card__dot--live]="isLive(b)"></span>
                    </div>
                    <div class="card__body">
                      <div class="card__top">
                        <strong>{{ b.petName || 'Visit' }}</strong>
                        <span class="badge" [attr.data-tone]="tone(b)">{{ b.customerStatus?.label || b.status }}</span>
                      </div>
                      <p class="when">{{ prettyWhen(b.scheduledDate, b.scheduledTime) }}</p>
                      <p class="meta">
                        {{ b.assignedDoctor || 'Doctor assignment pending' }}
                        @if (b.reason) {
                          <span>· {{ prettyReason(b.reason) }}</span>
                        }
                      </p>
                      <span class="card__go" aria-hidden="true">View</span>
                    </div>
                  </a>
                }
              </div>
            </section>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; max-width: 760px; }

    .head {
      display: flex; justify-content: space-between; align-items: flex-end;
      gap: 16px; margin-bottom: 22px;
    }
    .kicker {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-brand); font-weight: 700;
    }
    h1 {
      margin: 0;
      font-family: var(--vos-display);
      font-size: clamp(1.9rem, 4.5vw, 2.55rem);
      letter-spacing: -0.045em; line-height: 1.05;
    }
    .lede {
      margin: 8px 0 0;
      color: var(--vos-ink-muted);
      max-width: 40ch; line-height: 1.45; font-size: 1rem;
    }
    .book {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 46px; padding: 10px 18px; border-radius: 999px;
      background: #0a0a0a; color: #fff; font-weight: 700; text-decoration: none;
      white-space: nowrap;
    }
    .book--lg { min-height: 50px; padding: 14px 24px; margin-top: 8px; }
    .linkish {
      margin-left: 8px; border: 0; background: none; font-weight: 700;
      cursor: pointer; text-decoration: underline; color: #FD4A29;
    }
    .hero-skel { height: 160px; border-radius: 24px; margin-bottom: 14px; }

    .empty {
      padding: 40px 28px;
      border-radius: 28px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      text-align: center;
      box-shadow: 0 16px 40px rgba(10, 10, 10, 0.05);
    }
    .empty__kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: #FD4A29; font-weight: 700;
    }
    .empty h2 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: 1.6rem; letter-spacing: -0.03em;
    }
    .empty p { margin: 0 0 18px; color: var(--vos-ink-muted); }

    .hero {
      position: relative; display: block; overflow: hidden;
      text-decoration: none; color: #fff;
      border-radius: 26px; padding: 24px 22px 22px;
      margin-bottom: 18px;
      background:
        radial-gradient(ellipse 80% 90% at 100% -10%, rgba(255,255,255,0.22) 0%, transparent 55%),
        linear-gradient(145deg, #FD4A29 0%, #E03E20 45%, #1a100e 100%);
      box-shadow: 0 22px 48px rgba(253, 74, 41, 0.26);
      transition: transform 0.2s ease;
      animation: rise 0.45s ease both;
    }
    .hero:hover { transform: translateY(-3px); }
    .hero__glow {
      position: absolute; inset: auto -20% -40% 40%; height: 80%;
      background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
      pointer-events: none;
    }
    .hero__kicker {
      margin: 0 0 8px;
      font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
      opacity: 0.88; font-weight: 700;
    }
    .hero__title {
      display: block;
      font-family: var(--vos-display);
      font-size: clamp(1.45rem, 3.5vw, 1.85rem);
      letter-spacing: -0.035em; line-height: 1.15;
    }
    .hero__detail {
      margin: 8px 0 16px; opacity: 0.92; font-size: 1rem; line-height: 1.4;
    }
    .hero__cta {
      display: inline-flex; align-items: center;
      min-height: 40px; padding: 8px 16px; border-radius: 999px;
      background: #0a0a0a; color: #fff; font-weight: 700; font-size: 0.95rem;
    }

    .tabs {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 6px; padding: 5px; margin-bottom: 18px;
      background: #f3efe6; border-radius: 16px;
    }
    .tabs button {
      border: 0; background: transparent; cursor: pointer;
      min-height: 44px; border-radius: 12px;
      font-weight: 700; color: var(--vos-ink-muted);
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      font: inherit;
    }
    .tabs button.on {
      background: #fff; color: var(--vos-ink);
      box-shadow: 0 6px 16px rgba(10, 10, 10, 0.06);
    }
    .tabs em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 11px; font-weight: 700;
      min-width: 20px; height: 20px; padding: 0 6px;
      border-radius: 999px;
      background: var(--vos-brand-soft); color: var(--vos-brand);
      display: inline-flex; align-items: center; justify-content: center;
    }

    .quiet {
      text-align: center; padding: 28px 16px;
      color: var(--vos-ink-muted);
    }
    .quiet a { font-weight: 700; color: #FD4A29; }

    .group { margin-bottom: 22px; animation: rise 0.4s ease both; }
    .group__label {
      margin: 0 0 10px;
      font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .list { display: grid; gap: 10px; }

    .card {
      position: relative;
      display: grid; grid-template-columns: 28px 1fr;
      text-decoration: none; color: inherit;
      border-radius: 20px;
      background: #fffef9;
      border: 1px solid var(--vos-border);
      box-shadow: 0 10px 28px rgba(10, 10, 10, 0.045);
      overflow: hidden;
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(253, 74, 41, 0.3);
      box-shadow: 0 16px 36px rgba(10, 10, 10, 0.08);
    }
    .card--live {
      border-color: rgba(253, 74, 41, 0.35);
      background: linear-gradient(180deg, #fffef9 0%, #fff5f3 100%);
    }
    .card__rail {
      display: flex; justify-content: center;
      padding-top: 26px;
      background: linear-gradient(180deg, rgba(253,74,41,0.06), transparent);
    }
    .card__dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #d4cfc4;
      box-shadow: 0 0 0 4px rgba(212, 207, 196, 0.35);
    }
    .card__dot--live {
      background: #FD4A29;
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.22);
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    .card__body {
      position: relative;
      padding: 16px 18px 16px 4px;
    }
    .card__top {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
    }
    .card__top strong {
      font-family: var(--vos-display);
      font-size: 1.2rem; letter-spacing: -0.03em;
    }
    .badge {
      display: inline-flex; align-items: center;
      min-height: 28px; padding: 2px 10px; border-radius: 999px;
      background: var(--vos-brand-soft); color: var(--vos-brand);
      font-weight: 700; font-size: 0.78rem; white-space: nowrap;
    }
    .badge[data-tone='done'] {
      background: #ecfdf3; color: #1F7A4C;
    }
    .badge[data-tone='warn'] {
      background: #fff7e8; color: #B7791F;
    }
    .badge[data-tone='muted'] {
      background: #f3efe6; color: #5C5A55;
    }
    .when {
      margin: 8px 0 4px;
      font-weight: 700; font-size: 1.02rem;
    }
    .meta {
      margin: 0; color: var(--vos-ink-muted); font-size: 0.92rem; line-height: 1.35;
      padding-right: 48px;
    }
    .card__go {
      position: absolute; right: 16px; bottom: 16px;
      font-weight: 700; font-size: 0.88rem; color: #FD4A29;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .hero, .group, .card__dot--live { animation: none !important; }
    }
  `],
})
export class BookingsListComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tab = signal<FilterTab>('upcoming');

  readonly upcoming = computed(() => this.items().filter((b) => this.isUpcoming(b)));
  readonly past = computed(() => this.items().filter((b) => !this.isUpcoming(b)));
  readonly filtered = computed(() => {
    const t = this.tab();
    if (t === 'upcoming') return this.upcoming();
    if (t === 'past') return this.past();
    return this.items();
  });
  readonly nextUp = computed(() => this.upcoming()[0] || null);
  readonly grouped = computed(() => this.groupByMonth(this.filtered()));

  constructor(private api: CustomerApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = (await this.api.bookings()) || [];
      this.items.set(this.sortBookings(list));
      if (!this.upcoming().length && this.past().length) this.tab.set('past');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Couldn’t load appointments');
    } finally {
      this.loading.set(false);
    }
  }

  isUpcoming(b: any): boolean {
    const status = String(b?.status || b?.customerStatus?.code || '').toLowerCase();
    if (['completed', 'cancelled', 'canceled', 'no_show', 'closed'].includes(status)) return false;
    const when = this.whenDate(b);
    if (!when) return true;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return when.getTime() >= Date.now() - 6 * 3600 * 1000;
  }

  isLive(b: any): boolean {
    const label = String(b?.customerStatus?.label || b?.status || '').toLowerCase();
    return /en route|arrived|consultation|on the way|live|confirmed|assigned|dispatched/.test(label);
  }

  tone(b: any): string {
    const label = String(b?.customerStatus?.label || b?.status || '').toLowerCase();
    if (/complete|done|closed/.test(label)) return 'done';
    if (/cancel|fail|miss/.test(label)) return 'muted';
    if (/pending|wait|review/.test(label)) return 'warn';
    return 'brand';
  }

  prettyWhen(dateStr?: string | null, timeStr?: string | null): string {
    const time = String(timeStr || '').trim();
    if (!dateStr) return time || 'Schedule TBD';
    const raw = String(dateStr);
    const d = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return `${raw}${time ? ` · ${time}` : ''}`.trim();
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return time ? `${day} · ${time}` : day;
  }

  prettyReason(reason: string): string {
    const r = String(reason || '').trim();
    if (!r) return '';
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  private whenDate(b: any): Date | null {
    const raw = String(b?.scheduledDate || '');
    if (!raw) return null;
    const d = new Date(raw.includes('T') ? raw : `${raw.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private sortBookings(list: any[]): any[] {
    return [...list].sort((a, b) => {
      const da = this.whenDate(a)?.getTime() || 0;
      const db = this.whenDate(b)?.getTime() || 0;
      const ua = this.isUpcoming(a) ? 0 : 1;
      const ub = this.isUpcoming(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (ua === 0) return da - db;
      return db - da;
    });
  }

  private groupByMonth(list: any[]): Array<{ key: string; label: string; items: any[] }> {
    const map = new Map<string, any[]>();
    for (const b of list) {
      const d = this.whenDate(b);
      const key = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return [...map.entries()].map(([key, items]) => {
      if (key === 'unknown') return { key, label: 'Date TBD', items };
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      return { key, label, items };
    });
  }
}
