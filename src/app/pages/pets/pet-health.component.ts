import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';
import { VosTitleCasePipe } from '../../shared/vos-title-case.pipe';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent, VosTitleCasePipe],
  selector: 'app-pet-health',
  template: `
    <vos-back-button [fallback]="['/pets', petId]" fallbackLabel="Pet" />
    <h1>Pet Health</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (summary(); as s) {
      <p class="vos-muted">{{ s.pet?.name | vosTitleCase }} · Overview from recorded care only</p>

      <section class="vos-card">
        <p class="label">Care status</p>
        @if (s.careStatus?.upcomingFollowUp; as fu) {
          <a class="row" routerLink="/follow-ups">
            <strong>Follow-up</strong>
            <span>{{ fu.reason || 'Recheck' }} · due {{ (fu.dueAt || '').slice(0, 10) }}</span>
          </a>
        }
        @if (s.careStatus?.activeMedications?.length) {
          <a class="row" [routerLink]="['/pets', petId, 'medications']">
            <strong>Medications</strong>
            <span>{{ s.careStatus.activeMedications.length }} active · next {{ s.careStatus.activeMedications[0].medicine }}</span>
          </a>
        }
        @if (s.careStatus?.nextVaccination; as vax) {
          <a class="row" [routerLink]="['/pets', petId, 'vaccinations']">
            <strong>Next vaccination</strong>
            <span>{{ vax.vaccineName }} · {{ vax.nextDueOn || '—' }}</span>
          </a>
        }
        @if (s.careStatus?.lastVisit; as lv) {
          <a class="row" [routerLink]="['/visits', lv.id]">
            <strong>Last visit</strong>
            <span>{{ (lv.completedAt || '').slice(0, 10) }} · {{ doctorLabel(lv.doctorName) }}</span>
          </a>
        }
        @if (s.careStatus?.lastWeight; as w) {
          <a class="row" [routerLink]="['/pets', petId, 'weight']">
            <strong>Weight</strong>
            <span>{{ w.value }} {{ w.unit }}</span>
          </a>
        }
        @if (s.careStatus?.conditions?.length) {
          <a class="row" [routerLink]="['/pets', petId, 'conditions']">
            <strong>Conditions</strong>
            <span>{{ conditionNames(s.careStatus.conditions) }}</span>
          </a>
        }
        @if (s.careStatus?.activeCarePlans?.length) {
          <a class="row" [routerLink]="['/pets', petId, 'care-plans']">
            <strong>Care plans</strong>
            <span>{{ s.careStatus.activeCarePlans.length }} active</span>
          </a>
        }
        @if (s.careStatus?.openReminders) {
          <a class="row" [routerLink]="['/pets', petId, 'reminders']">
            <strong>Reminders</strong>
            <span>{{ s.careStatus.openReminders }} open</span>
          </a>
        }
        @if (s.note) {
          <p class="note">{{ s.note }}</p>
        }
      </section>

      @if (careNext(); as cn) {
        <section class="vos-card">
          <p class="label">{{ cn.title || 'What should I do next?' }}</p>
          @for (item of cn.items || []; track item.type) {
            <a class="row" [routerLink]="careLink(item)">
              <strong>{{ careLabel(item) }}</strong>
              <span>{{ careDetail(item) }}</span>
            </a>
          }
          @if (!(cn.items || []).length) {
            <p class="vos-muted">No open next steps from your records.</p>
          }
          @if (cn.note) {
            <p class="note">{{ cn.note }}</p>
          }
        </section>
      }

      <div class="quick-actions">
        <a class="vos-btn vos-btn-secondary" [routerLink]="['/intake']" [queryParams]="{ petId }">Something is wrong</a>
        <a class="vos-btn vos-btn-ghost" [routerLink]="['/assistant']" [queryParams]="{ petId }">VetonSpot Assistant</a>
      </div>

      <nav class="tabs" aria-label="Health sections">
        <a class="tab on" [routerLink]="['/pets', petId, 'health']">Overview</a>
        <a class="tab" [routerLink]="['/pets', petId, 'timeline']">Timeline</a>
        <a class="tab" [routerLink]="['/pets', petId, 'medications']">Medications</a>
        <a class="tab" [routerLink]="['/pets', petId, 'vaccinations']">Vaccinations</a>
        <a class="tab" [routerLink]="['/pets', petId, 'diagnostics']">Diagnostics</a>
        <a class="tab" [routerLink]="['/pets', petId, 'conditions']">Conditions</a>
        <a class="tab" [routerLink]="['/pets', petId, 'care-plans']">Care plans</a>
        <a class="tab" [routerLink]="['/pets', petId, 'documents']">Documents</a>
        <a class="tab" [routerLink]="['/pets', petId, 'reminders']">Reminders</a>
        <a class="tab" [routerLink]="['/pets', petId, 'calendar']">Calendar</a>
        <a class="tab" [routerLink]="['/pets', petId, 'weight']">Weight</a>
        <a class="tab" [routerLink]="['/pets', petId, 'passport']">Passport</a>
      </nav>
    }
  `,
  styles: [`
    h1 { margin: 4px 0; font-family: var(--vos-display); }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .row {
      display: flex; flex-direction: column; gap: 2px; padding: 10px 0;
      border-top: 1px solid var(--vos-border); text-decoration: none; color: inherit;
    }
    .row span { color: var(--vos-ink-muted); font-size: 0.9rem; }
    .note { margin: 12px 0 0; font-size: 0.85rem; color: var(--vos-ink-muted); }
    .quick-actions { display: grid; gap: 8px; margin: 14px 0; }
    .tabs {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin: 14px 0 0; padding: 4px;
      background: #f3efe6; border-radius: 14px;
    }
    .tab {
      display: inline-flex; align-items: center;
      min-height: 36px; padding: 6px 12px; border-radius: 10px;
      text-decoration: none; color: var(--vos-ink-muted);
      font-weight: 700; font-size: 0.88rem; white-space: nowrap;
    }
    .tab:hover { color: var(--vos-ink); background: rgba(255,255,255,0.55); }
    .tab.on {
      background: #fff; color: var(--vos-ink);
      box-shadow: 0 4px 12px rgba(10, 10, 10, 0.06);
    }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetHealthComponent implements OnInit {
  readonly summary = signal<any>(null);
  readonly careNext = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    if (this.petId) this.activePet.set(this.petId);
    void this.load();
  }

  conditionNames(list: any[]): string {
    return (list || []).map((c) => c?.name).filter(Boolean).join(', ');
  }

  doctorLabel(name: string | null | undefined): string {
    let n = String(name || '').trim();
    if (!n) return 'Doctor TBD';
    n = n.replace(/^(Dr\.?\s*)+/i, '').trim();
    return n ? `Dr. ${n}` : 'Doctor TBD';
  }

  careLink(item: any): any {
    switch (item?.type) {
      case 'follow_up':
        return '/follow-ups';
      case 'medications':
        return ['/pets', this.petId, 'medications'];
      case 'vaccination':
        return ['/pets', this.petId, 'vaccinations'];
      case 'lab':
        return ['/pets', this.petId, 'diagnostics'];
      case 'reminders':
        return ['/pets', this.petId, 'reminders'];
      default:
        return ['/pets', this.petId, 'health'];
    }
  }

  careLabel(item: any): string {
    switch (item?.type) {
      case 'follow_up':
        return item.data?.reason || 'Follow-up';
      case 'medications':
        return 'Medications';
      case 'vaccination':
        return item.data?.vaccineName || 'Vaccination';
      case 'lab':
        return item.data?.testName || 'Lab result';
      case 'reminders':
        return 'Reminders';
      default:
        return item?.type || 'Care item';
    }
  }

  careDetail(item: any): string {
    switch (item?.type) {
      case 'follow_up':
        return `due ${(item.data?.dueAt || '').slice(0, 10) || '—'}`;
      case 'medications':
        return `${item.count || 0} active on record`;
      case 'vaccination':
        return `due ${item.data?.nextDueOn || '—'}`;
      case 'lab':
        return item.data?.resultSummary || 'See diagnostics';
      case 'reminders':
        return `${item.count || 0} open`;
      default:
        return '';
    }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [summary, careNext] = await Promise.all([
        this.api.healthSummary(this.petId),
        this.api.careNext(this.petId).catch(() => null),
      ]);
      this.summary.set(summary);
      this.careNext.set(careNext);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
