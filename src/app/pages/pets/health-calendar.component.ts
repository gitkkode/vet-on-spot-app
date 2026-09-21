import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-health-calendar',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Health calendar</h1>
    <p class="vos-muted">Visits, follow-ups, vaccinations, and reminders by date.</p>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!days().length) {
      <p class="vos-empty">No calendar events in this range.</p>
    } @else {
      @for (day of days(); track day.date) {
        <section class="vos-card">
          <h2>{{ day.date }}</h2>
          @for (ev of day.events; track trackEv(ev)) {
            <div class="ev">
              <strong>{{ ev.title || ev.type }}</strong>
              <span class="vos-muted">{{ ev.type }}@if (ev.at) { · {{ (ev.at || '').slice(11, 16) }} }</span>
              @if (ev.meta?.reason) {
                <p class="vos-muted">{{ ev.meta.reason }}</p>
              }
              @if (ev.meta?.summary) {
                <p class="vos-muted">{{ ev.meta.summary }}</p>
              }
            </div>
          }
        </section>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1rem; }
    .ev {
      padding: 10px 0; border-top: 1px solid var(--vos-border);
      display: flex; flex-direction: column; gap: 2px;
    }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class HealthCalendarComponent implements OnInit {
  readonly days = signal<{ date: string; events: any[] }[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  trackEv(ev: any) {
    return `${ev.type}-${ev.id}-${ev.at}`;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const raw = await this.api.healthCalendar(this.petId);
      const events = Array.isArray(raw) ? raw : raw?.events || [];
      const byDate = new Map<string, any[]>();
      for (const ev of events) {
        const date = (ev.at || ev.date || '').slice(0, 10) || 'Unknown';
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(ev);
      }
      const sorted = [...byDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, list]) => ({ date, events: list }));
      this.days.set(sorted);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
