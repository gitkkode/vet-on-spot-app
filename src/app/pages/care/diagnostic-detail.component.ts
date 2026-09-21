import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-diagnostic-detail',
  template: `
    <a routerLink="/diagnostics" class="vos-back">← Diagnostics</a>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (d(); as lab) {
      <h1>{{ lab.testName }}</h1>
      <div class="vos-badge">{{ statusLabel(lab.status) }}</div>

      <div class="vos-card">
        <p><strong>Pet</strong> {{ lab.petName || '—' }}</p>
        <p><strong>Visit</strong> {{ lab.visitId || '—' }}</p>
        @if (lab.sampleType) { <p><strong>Sample</strong> {{ lab.sampleType }}</p> }
        @if (lab.reason) { <p><strong>Reason</strong> {{ lab.reason }}</p> }
        <p><strong>Ordered</strong> {{ formatTime(lab.createdAt) }}</p>
        @if (lab.resultReadyAt) { <p><strong>Result ready</strong> {{ formatTime(lab.resultReadyAt) }}</p> }
        @if (lab.reviewedAt) { <p><strong>Reviewed</strong> {{ formatTime(lab.reviewedAt) }}</p> }
      </div>

      @if (lab.customerMessage) {
        <div class="vos-ok">{{ lab.customerMessage }}</div>
      }

      @if (lab.status === 'reviewed' || lab.status === 'result_ready') {
        <div class="vos-card">
          <p class="label">Result</p>
          @if (lab.resultSummary) {
            <p>{{ lab.resultSummary }}</p>
          } @else if (lab.resultPayload) {
            <pre>{{ formatPayload(lab.resultPayload) }}</pre>
          } @else {
            <p class="vos-muted">No result text available yet.</p>
          }
          @if (lab.status === 'result_ready') {
            <p class="vos-muted tip">Awaiting veterinarian review before clinical interpretation.</p>
          }
        </div>
      } @else {
        <div class="vos-card">
          <p class="vos-muted">Results will appear here when ready and reviewed by your veterinarian.</p>
        </div>
      }

      @if (lab.visitId) {
        <a class="vos-btn vos-btn-secondary" [routerLink]="['/visits', lab.visitId]">Open visit summary</a>
      }
      <button type="button" class="vos-btn vos-btn-ghost" (click)="load()">Refresh</button>
    }
  `,
  styles: [`
    h1 { font-family: var(--vos-display); margin: 6px 0 8px; }
    .vos-badge { margin-bottom: 12px; }
    .vos-card p { margin: 8px 0; }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 700;
    }
    pre {
      white-space: pre-wrap; word-break: break-word; margin: 0;
      font-family: var(--vos-font); font-size: 0.92rem;
    }
    .tip { margin-top: 10px !important; font-size: 0.88rem; }
    .vos-btn { margin-top: 8px; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class DiagnosticDetailComponent implements OnInit {
  id = '';
  readonly d = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  statusLabel(s: string) {
    return (s || '').replace(/_/g, ' ');
  }

  formatTime(v: string | null | undefined) {
    if (!v) return '—';
    try {
      return new Date(v).toLocaleString();
    } catch {
      return v;
    }
  }

  formatPayload(payload: unknown) {
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  async load() {
    if (!this.id) {
      this.error.set('Missing diagnostic id');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      this.d.set(await this.api.diagnostic(this.id));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not load diagnostic');
    } finally {
      this.loading.set(false);
    }
  }
}
