import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';
import { VosTitleCasePipe } from '../../shared/vos-title-case.pipe';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, VosBackButtonComponent, VosTitleCasePipe],
  selector: 'app-second-opinion',
  template: `
    <vos-back-button [fallback]="'/health'" fallbackLabel="Health" />
    <h1>Second opinion</h1>
    <p class="vos-muted">
      Request another clinical perspective on a past visit. Include the visit reference and why you want a second look.
    </p>

    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @if (error()) { <div class="vos-err">{{ error() }}</div> }

    <form class="vos-card" (ngSubmit)="submit()">
      <label class="vos-field">Visit ID
        <input [(ngModel)]="visitId" name="visitId" required placeholder="e.g. VIS-…" />
      </label>
      <label class="vos-field">Reason
        <textarea [(ngModel)]="reason" name="reason" rows="4" required placeholder="What would you like reviewed?"></textarea>
      </label>
      <button class="vos-btn" type="submit" [disabled]="!visitId.trim() || !reason.trim() || saving()">
        {{ saving() ? 'Submitting…' : 'Request second opinion' }}
      </button>
    </form>

    <h2>Your referrals</h2>
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No referrals yet.</p>
    } @else {
      @for (r of items(); track r.id) {
        <div class="vos-card">
          <div class="row">
            <strong>{{ kindLabel(r.kind) }}</strong>
            <span class="vos-badge">{{ r.status }}</span>
          </div>
          <p class="vos-muted">{{ r.petName | vosTitleCase:'Pet' }} · visit {{ r.visitId || '—' }}</p>
          @if (r.reason) { <p>{{ r.reason }}</p> }
          @if (r.responseText) {
            <div class="resp">
              <p class="label">Response</p>
              <p>{{ r.responseText }}</p>
              @if (r.respondedAt) {
                <p class="vos-muted">{{ (r.respondedAt || '').slice(0, 10) }}</p>
              }
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    h1 { font-family: var(--vos-display); margin: 4px 0 6px; }
    h2 { font-family: var(--vos-display); font-size: 1.1rem; margin: 20px 0 10px; }
    .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .label {
      margin: 0 0 4px; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 700;
    }
    .resp {
      margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--vos-border);
    }
  `],
})
export class SecondOpinionComponent implements OnInit {
  visitId = '';
  reason = '';
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.visitId = this.route.snapshot.queryParamMap.get('visitId') || '';
    void this.load();
  }

  kindLabel(kind: string) {
    if (kind === 'second_opinion') return 'Second opinion';
    return (kind || 'Referral').replace(/_/g, ' ');
  }

  async load() {
    this.loading.set(true);
    try {
      this.items.set((await this.api.referrals()) || []);
    } catch {
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async submit() {
    if (!this.visitId.trim() || !this.reason.trim()) return;
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      const row = await this.api.createSecondOpinion({
        visitId: this.visitId.trim(),
        reason: this.reason.trim(),
      });
      this.ok.set(`Second opinion requested (${row.id}).`);
      this.reason = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not submit request');
    } finally {
      this.saving.set(false);
    }
  }
}
