import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { HealthShellComponent } from '../../shared/health-shell.component';
import { HealthEmptyComponent } from '../../shared/health-empty.component';

@Component({
  standalone: true,
  imports: [RouterLink, HealthShellComponent, HealthEmptyComponent],
  selector: 'app-health-calendar',
  template: `
    <vos-health-shell
      [petId]="petId"
      section="calendar"
      sectionTitle="Calendar"
      lede="Visits, follow-ups, vaccinations, and reminders by date."
    >
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!days().length) {
      <vos-health-empty
        title="No calendar events"
        message="Visits, follow-ups, and reminders will show here by date once they’re on file."
      >
        <a class="vos-btn" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
      </vos-health-empty>
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
    </vos-health-shell>
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
export class HealthCalendarComponent implements OnInit, OnDestroy {
  readonly days = signal<{ date: string; events: any[] }[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';
  private sub?: Subscription;

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id') || '';
      if (!id || id === this.petId) return;
      this.petId = id;
      void this.load();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  trackEv(ev: any) {
    return `${ev.type}-${ev.id}-${ev.at}`;
  }

  async load() {
    const id = this.petId;
    this.loading.set(true);
    this.error.set('');
    try {
      const raw = await this.api.healthCalendar(id);
      if (id !== this.petId) return;
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
      if (id !== this.petId) return;
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      if (id === this.petId) this.loading.set(false);
    }
  }
}
