import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { titleCase } from '../../utils/health-records';
import { HealthShellComponent } from '../../shared/health-shell.component';

@Component({
  standalone: true,
  imports: [RouterLink, HealthShellComponent],
  selector: 'app-health-hub',
  template: `
    <vos-health-shell
      [petId]="active() || ''"
      section="overview"
      sectionTitle="Health"
      lede="Ongoing care records for your active pet — no scores, just what’s on file."
    >
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (!pets().length && !loading()) {
      <p class="vos-empty">Add a pet to see health records.</p>
      <a class="vos-btn" routerLink="/pets/new">Add pet</a>
    } @else {
      @if (loading()) {
        <div class="vos-skel"></div>
      } @else if (summary(); as s) {
        <section class="vos-card">
          <p class="label">Overview · {{ titleCase(s.pet?.name) }}</p>
          @if (s.careStatus?.upcomingFollowUp; as fu) {
            <a class="row" routerLink="/follow-ups">
              <strong>Follow-up</strong>
              <span>{{ fu.reason || 'Recheck' }} · due {{ (fu.dueAt || '').slice(0, 10) }}</span>
            </a>
          }
          @if (s.careStatus?.activeMedications?.length) {
            <a class="row" [routerLink]="['/pets', active(), 'medications']">
              <strong>Next medication</strong>
              <span>{{ s.careStatus.activeMedications[0].medicine }}</span>
            </a>
          }
          @if (s.careStatus?.nextVaccination; as vax) {
            <a class="row" [routerLink]="['/pets', active(), 'vaccinations']">
              <strong>Vaccination</strong>
              <span>{{ vax.vaccineName }} · due {{ vax.nextDueOn || '—' }}</span>
            </a>
          }
          @if (s.careStatus?.lastWeight; as w) {
            <a class="row" [routerLink]="['/pets', active(), 'weight']">
              <strong>Last weight</strong>
              <span>{{ w.value }} {{ w.unit }} · {{ (w.at || '').slice(0, 10) }}</span>
            </a>
          }
          @if (s.careStatus?.openReminders) {
            <a class="row" [routerLink]="['/pets', active(), 'reminders']">
              <strong>Reminders</strong>
              <span>{{ s.careStatus.openReminders }} open</span>
            </a>
          }
          @if (!hasCareBits(s)) {
            <p class="vos-muted">No open care items yet. Visit history will appear after appointments.</p>
          }
          @if (s.note) {
            <p class="note">{{ s.note }}</p>
          }
        </section>
      }
    }
    </vos-health-shell>
  `,
  styles: [`
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
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class HealthHubComponent implements OnInit {
  readonly pets = signal<any[]>([]);
  readonly active = signal<string | null>(null);
  readonly summary = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    void this.load();
  }

  titleCase = titleCase;

  hasCareBits(s: any): boolean {
    const c = s?.careStatus;
    return !!(
      c?.upcomingFollowUp ||
      c?.activeMedications?.length ||
      c?.nextVaccination ||
      c?.lastWeight ||
      c?.openReminders
    );
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const pets = (await this.api.pets()) || [];
      this.pets.set(pets);
      const id = this.activePet.syncFromPets(pets);
      this.active.set(id);
      if (id) {
        this.summary.set(await this.api.healthSummary(id));
      } else {
        this.summary.set(null);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }

  async pick(id: string) {
    this.activePet.set(id);
    this.active.set(id);
    this.loading.set(true);
    this.error.set('');
    try {
      this.summary.set(await this.api.healthSummary(id));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed to load');
    } finally {
      this.loading.set(false);
    }
  }
}
