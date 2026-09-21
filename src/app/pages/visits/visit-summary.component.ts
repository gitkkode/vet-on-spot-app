import { Component, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink, SlicePipe],
  selector: 'app-visit-summary',
  template: `
    <a routerLink="/bookings" class="vos-back">← Appointments</a>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" (click)="load()">Retry</button></div>
    }
    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (v()) {
      @if (v().status === 'completed') {
        <div class="banner">Visit completed</div>
      } @else {
        <div class="banner progress">Visit in progress</div>
      }
      <h1 class="vos-pet-name">{{ v().petName || v().pet?.name }}</h1>
      <p class="sub">{{ v().displayId }} · Dr. {{ v().doctorName }}</p>
      <div class="vos-card">
        <p><strong>Date</strong> {{ (v().completedAt || v().startedAt || '') | slice:0:10 }}</p>
        <p><strong>Reason</strong> {{ v().chiefComplaint || v().bookingReason || '—' }}</p>
        @if (v().summary) { <p><strong>Summary</strong> {{ v().summary }}</p> }
      </div>

      @if (v().diagnoses?.length) {
        <div class="vos-card">
          <h2>Diagnosis</h2>
          @for (d of v().diagnoses; track d.id) {
            <p>{{ d.diagnosis }} <span class="vos-muted">({{ d.kind }})</span></p>
          }
        </div>
      }

      @if (v().treatments?.length) {
        <div class="vos-card">
          <h2>Treatment</h2>
          @for (t of v().treatments; track t.id) {
            <p><strong>{{ t.name }}</strong> {{ t.instructions || '' }}</p>
          }
        </div>
      }

      @if (v().prescription) {
        <div class="vos-card">
          <h2>Prescription</h2>
          @for (i of v().prescription.items || []; track i.id) {
            <p><strong>{{ i.medicine }}</strong> {{ i.strength || '' }}</p>
            <p class="vos-muted">{{ i.dose }} {{ i.unit }} · {{ i.frequency }} · {{ i.duration }}</p>
            @if (i.instructions) { <p>{{ i.instructions }}</p> }
            <button
              type="button"
              class="track-btn"
              [disabled]="tracking() === i.id"
              (click)="addToMeds(i)"
            >
              {{ tracking() === i.id ? 'Adding…' : 'Add to medication tracking' }}
            </button>
          }
        </div>
      }

      @if (v().followUps?.length) {
        <div class="vos-card">
          <h2>Follow-up</h2>
          @for (f of v().followUps; track f.id) {
            <p><strong>{{ f.dueAt }}</strong> — {{ f.reason || 'Recheck' }}</p>
            @if (f.instructions) { <p>{{ f.instructions }}</p> }
          }
          <a routerLink="/follow-ups">Open follow-ups</a>
        </div>
      }

      @if (v().petId) {
        <a class="vos-btn" [routerLink]="['/pets', v().petId, 'health']">Medical timeline</a>
        <a class="vos-btn vos-btn-secondary" routerLink="/medications" style="margin-top:10px">Medication tracker</a>
      }
    }
  `,
  styles: [`
    h1, h2 { color: var(--vos-ink); }
    h1 { font-family: var(--vos-display); margin: 8px 0 4px; }
    .banner {
      background: var(--vos-brand); color: #fff; padding: 12px 14px;
      border-radius: var(--vos-radius-sm); font-weight: 700; margin: 10px 0;
    }
    .banner.progress { background: var(--vos-info); }
    .sub { color: var(--vos-ink-muted); margin-top: 0; }
    .track-btn {
      display: block; width: 100%; margin: 8px 0 14px; padding: 10px;
      border-radius: 10px; border: 1px solid var(--vos-border);
      background: var(--vos-brand-soft); color: var(--vos-brand); font-weight: 700; cursor: pointer;
    }
    .vos-btn { margin-top: 8px; }
    button[type=button]:not(.track-btn) { margin-left: 8px; }
  `],
})
export class VisitSummaryComponent implements OnInit {
  readonly v = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly ok = signal('');
  readonly tracking = signal('');
  private id = '';

  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.v.set(await this.api.visit(this.id));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async addToMeds(item: any) {
    const visit = this.v();
    if (!visit?.petId || !item?.medicine) return;
    this.tracking.set(item.id || item.medicine);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.createMedication({
        petId: visit.petId,
        medicine: item.medicine,
        strength: item.strength || '',
        dose: [item.dose, item.unit].filter(Boolean).join(' '),
        frequency: item.frequency || '',
        instructions: item.instructions || '',
        prescriptionItemId: item.id || undefined,
      });
      this.ok.set(`${item.medicine} added to medication tracking.`);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not add medication');
    } finally {
      this.tracking.set('');
    }
  }
}
