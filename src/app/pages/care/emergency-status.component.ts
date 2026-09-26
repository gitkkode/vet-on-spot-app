import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';
import { VosTitleCasePipe } from '../../shared/vos-title-case.pipe';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent, VosTitleCasePipe],
  selector: 'app-emergency-status',
  template: `
    <vos-back-button [fallback]="'/emergency'" fallbackLabel="Urgent care" />
    <h1>Emergency status</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (case_(); as c) {
      <p class="ref">{{ c.displayId }}</p>
      <div class="vos-badge status">{{ c.status }}</div>
      @if (c.triageLevel) {
        <span class="vos-badge triage">{{ c.triageLevel }}</span>
      }

      <div class="vos-card">
        <p><strong>{{ c.petName | vosTitleCase:'Pet' }}</strong></p>
        <p>{{ c.category }}</p>
        <p class="vos-muted">{{ c.reason }}</p>
        @if (c.location) { <p><strong>Location</strong> {{ c.location }}</p> }
        @if (c.phone) { <p><strong>Phone</strong> {{ c.phone }}</p> }
        <p class="vos-muted">Reported {{ formatTime(c.createdAt) }}</p>
      </div>

      <div class="vos-card">
        <p class="label">Tracking</p>
        @if (c.tracking; as t) {
          <p><strong>Booking</strong> {{ t.bookingStatus || c.bookingStatus || '—' }}</p>
          <p><strong>Doctor</strong> {{ t.doctorName || c.assignedDoctorName || 'Awaiting assignment' }}</p>
          @if (t.enRouteAt) { <p><strong>En route</strong> {{ formatTime(t.enRouteAt) }}</p> }
          @if (t.arrivedAt) { <p><strong>Arrived</strong> {{ formatTime(t.arrivedAt) }}</p> }
          @if (t.estimatedArrivalMinutes != null) {
            <p><strong>ETA</strong> ~{{ t.estimatedArrivalMinutes }} min</p>
          }
          <p class="vos-muted note">{{ t.note || 'Status updates reflect the linked care request only.' }}</p>
        } @else {
          <p class="vos-muted">Tracking will appear once a care request is linked.</p>
        }
      </div>

      @if (c.bookingId) {
        <a class="vos-btn" [routerLink]="['/bookings', c.bookingId, 'track']">Track care request</a>
        <a class="vos-btn vos-btn-secondary" [routerLink]="['/bookings', c.bookingId]">Open booking</a>
      }

      <button type="button" class="vos-btn vos-btn-ghost" (click)="load()">Refresh</button>
    }
  `,
  styles: [`
    h1 { font-family: var(--vos-display); margin: 4px 0 8px; }
    .ref { margin: 0 0 8px; color: var(--vos-ink-muted); font-weight: 600; }
    .status { background: #fdecec; color: var(--vos-danger); margin-right: 6px; }
    .triage { background: #fff6e8; color: var(--vos-warning); }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 700;
    }
    .vos-card p { margin: 8px 0; }
    .note { font-size: 0.88rem; margin-top: 12px !important; }
    .vos-btn { margin-top: 8px; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class EmergencyStatusComponent implements OnInit {
  id = '';
  readonly case_ = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  formatTime(v: string | null | undefined) {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString();
    } catch {
      return v;
    }
  }

  async load() {
    if (!this.id) {
      this.error.set('Missing emergency id');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      this.case_.set(await this.api.emergency(this.id));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not load emergency');
    } finally {
      this.loading.set(false);
    }
  }
}
