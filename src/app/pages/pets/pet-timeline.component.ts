import { Component, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink, SlicePipe],
  selector: 'app-pet-timeline',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Timeline</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (data()) {
      <p class="vos-muted">{{ data().pet?.name }} · Medical visits</p>

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
        <p class="vos-empty">No clinical visits yet. After a veterinarian completes a visit, it will appear here.</p>
      }

      @for (e of data().events || []; track e.displayId) {
        <article class="vos-card">
          <p class="date">{{ e.date | slice: 0:10 }}</p>
          <h2>{{ e.title }}</h2>
          <p class="vos-muted">Dr. {{ e.doctorName }} · {{ e.status }}</p>
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
export class PetTimelineComponent implements OnInit {
  readonly data = signal<any>(null);
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

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.petTimeline(this.petId));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
