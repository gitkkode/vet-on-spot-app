import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { titleCase } from '../../utils/health-records';
import { HealthShellComponent } from '../../shared/health-shell.component';
import { HealthEmptyComponent } from '../../shared/health-empty.component';

@Component({
  standalone: true,
  imports: [RouterLink, SlicePipe, HealthShellComponent, HealthEmptyComponent],
  selector: 'app-pet-timeline',
  template: `
    <vos-health-shell [petId]="petId" section="timeline" sectionTitle="Timeline" lede="Medical visits and follow-ups on file.">
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (data()) {
      <p class="vos-muted">{{ titleCase(data().pet?.name) }} · Medical visits</p>

      @if (data().upcomingFollowUps?.length) {
        <section class="vos-card">
          <h2>Follow-ups</h2>
          @for (f of data().upcomingFollowUps; track f.id) {
            <p><strong>{{ (f.dueAt || '').slice(0, 10) }}</strong> — {{ f.reason || 'Recheck' }}</p>
            @if (f.instructions) {
              <p class="vos-muted">{{ f.instructions }}</p>
            }
          }
        </section>
      }

      @if (!(data().events || []).length) {
        <vos-health-empty
          title="No visits yet"
          message="After a veterinarian completes a visit, it will appear here."
        >
          <a class="vos-btn" [routerLink]="['/book/new']" [queryParams]="{ petId }">Book a visit</a>
        </vos-health-empty>
      }

      @for (e of data().events || []; track e.displayId) {
        <article class="vos-card">
          <p class="date">{{ e.date | slice: 0:10 }}</p>
          <h2>{{ e.title }}</h2>
          <p class="vos-muted">{{ doctorLabel(e.doctorName) }} · {{ prettyStatus(e.status) }}</p>
          @if (e.reason) {
            <p><strong>Reason</strong> {{ e.reason }}</p>
          }
          @if (e.summary) {
            <p>{{ e.summary }}</p>
          }
          @if (e.diagnoses?.length) {
            <p>
              <strong>Diagnosis</strong>
              @for (d of e.diagnoses; track d.id) {
                <span>{{ d.diagnosis }}@if (!$last) {, }</span>
              }
            </p>
          }
          @if (e.treatments?.length) {
            <p>
              <strong>Treatment</strong>
              @for (t of e.treatments; track t.id) {
                <span>{{ t.name }}@if (!$last) {, }</span>
              }
            </p>
          }
          <a class="link" [routerLink]="['/visits', e.displayId]">Visit summary</a>
        </article>
      }
    }
    </vos-health-shell>
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1.1rem; }
    .date {
      font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--vos-ink-muted); margin: 0;
    }
    .link { display: inline-block; margin-top: 8px; font-weight: 700; text-decoration: none; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetTimelineComponent implements OnInit, OnDestroy {
  readonly data = signal<any>(null);
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

  titleCase = titleCase;

  doctorLabel(name: string | null | undefined): string {
    let n = String(name || '').trim();
    if (!n) return 'Doctor TBD';
    // Collapse duplicated Dr. prefixes and ensure a single spaced title
    n = n.replace(/^(Dr\.?\s*)+/i, '').trim();
    return n ? `Dr. ${n}` : 'Doctor TBD';
  }

  prettyStatus(status: string | null | undefined): string {
    const raw = String(status || '').trim();
    if (!raw) return 'Scheduled';
    const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
    const map: Record<string, string> = {
      in_progress: 'In progress',
      visit_in_progress: 'In progress',
      completed: 'Visit completed',
      cancelled: 'Cancelled',
      canceled: 'Cancelled',
      confirmed: 'Doctor confirmed',
      doctor_confirmed: 'Doctor confirmed',
      assigned: 'Doctor confirmed',
      pending: 'Pending',
      received: 'Booking received',
      booking_received: 'Booking received',
      en_route: 'En route',
      arrived: 'Arrived',
      no_show: 'Missed',
      missed: 'Missed',
    };
    if (map[key]) return map[key];
    // Fallback: snake_case / camelCase → Title Case words
    return raw
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  async load() {
    const id = this.petId;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.petTimeline(id);
      if (id !== this.petId) return;
      this.data.set(data);
    } catch (e: any) {
      if (id !== this.petId) return;
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      if (id === this.petId) this.loading.set(false);
    }
  }
}
