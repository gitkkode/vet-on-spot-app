import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-medications',
  template: `
    @if (petId) {
      <a [routerLink]="['/pets', petId, 'health']" class="vos-back">← Health</a>
    } @else {
      <a routerLink="/health" class="vos-back">← Health</a>
    }
    <h1>Medications</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!meds().length) {
      <p class="vos-empty">No medication schedules yet. After a visit, you can add medicines from the prescription.</p>
    } @else {
      @for (m of meds(); track m.id) {
        <article class="vos-card">
          <div class="top">
            <h2>{{ m.medicine }}</h2>
            <span class="badge">{{ m.status || (m.active === false ? 'COMPLETED' : 'ACTIVE') }}</span>
          </div>
          <p class="vos-muted">{{ titleCase(m.petName) }} · {{ m.dose }} {{ m.frequency }}</p>
          <div class="slots">
            @for (slot of slotsFor(m); track slot) {
              <div class="slot-row">
                <button
                  type="button"
                  class="slot"
                  [disabled]="logged(m, slot) === 'taken'"
                  (click)="mark(m.id, slot, 'taken')"
                >
                  {{ slot }} · {{ logged(m, slot) || 'Mark taken' }}
                </button>
                <button type="button" class="skip" (click)="mark(m.id, slot, 'skipped')">Skip</button>
                <button
                  type="button"
                  class="snooze"
                  [disabled]="logged(m, slot) === 'taken'"
                  (click)="mark(m.id, slot, 'snoozed')"
                >
                  Snooze
                </button>
              </div>
            }
          </div>
        </article>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1.1rem; margin: 0; }
    .top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .badge {
      font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 8px;
      background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .slots { display: grid; gap: 8px; margin-top: 10px; }
    .slot-row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; }
    .slot, .skip, .snooze {
      min-height: 44px; border-radius: 12px; border: 1px solid var(--vos-border);
      background: #fff; font-weight: 600; cursor: pointer; padding: 0 10px;
    }
    .slot { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .snooze { color: var(--vos-warning); }
  `],
})
export class MedicationsComponent implements OnInit {
  readonly meds = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    if (this.petId) this.activePet.set(this.petId);
    void this.load();
  }

  titleCase(v: string | null | undefined): string {
    const raw = String(v || '').trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  slotsFor(m: any): string[] {
    const t = m.times || {};
    return (['morning', 'afternoon', 'evening', 'night'] as const).filter((s) => t[s]);
  }

  logged(m: any, slot: string) {
    return (m.today || []).find((x: any) => x.slot === slot)?.status || '';
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const id = this.petId || this.activePet.get();
      this.meds.set((await this.api.medications(id)) || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async mark(id: string, slot: string, status: 'taken' | 'skipped' | 'unable' | 'snoozed') {
    try {
      await this.api.logMedicationDose(id, { slot, status });
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save');
    }
  }
}
