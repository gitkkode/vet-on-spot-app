import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { titleCase } from '../../utils/health-records';
import { VosSelectComponent, VosSelectOption } from '../../shared/vos-select.component';
import { HealthShellComponent } from '../../shared/health-shell.component';

const DOSE_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const;
type DoseSlot = (typeof DOSE_SLOTS)[number];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, VosSelectComponent, HealthShellComponent],
  selector: 'app-medications',
  template: `
    <vos-health-shell
      [petId]="petId"
      section="medications"
      sectionTitle="Medications"
      lede="Track doses after a visit, or add a schedule yourself."
    >

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }

    <section class="panel">
      <div class="panel__row">
        <div>
          <h2>{{ editingId() ? 'Edit schedule' : 'Add a medicine' }}</h2>
          <p class="hint">Choose the pet, the dose, and which times of day it is due.</p>
        </div>
        @if (!formOpen()) {
          <button type="button" class="vos-btn" (click)="openCreate()">Add a medicine</button>
        }
      </div>

      @if (formOpen()) {
        <form class="form" (ngSubmit)="saveSchedule()">
          @if (!petId) {
            <label class="vos-field">
              Pet
              <vos-select
                name="medPet"
                ariaLabel="Pet"
                [options]="petOptions()"
                [(ngModel)]="formPetId"
              />
            </label>
          }
          <label class="vos-field">
            Medicine
            <input [(ngModel)]="medicine" name="medicine" required placeholder="e.g. Amoxicillin" />
          </label>
          <div class="grid">
            <label class="vos-field">
              Strength
              <input [(ngModel)]="strength" name="strength" placeholder="e.g. 250 mg" />
            </label>
            <label class="vos-field">
              Dose
              <input [(ngModel)]="dose" name="dose" placeholder="e.g. 1 tablet" />
            </label>
          </div>
          <label class="vos-field">
            Frequency
            <input [(ngModel)]="frequency" name="frequency" placeholder="e.g. Twice a day" />
          </label>
          <p class="hint">Dose times</p>
          <div class="pills" role="group" aria-label="Dose times">
            @for (slot of doseSlots; track slot) {
              <button
                type="button"
                class="pill"
                [class.on]="times[slot]"
                (click)="toggleTime(slot)"
              >
                {{ slot }}
              </button>
            }
          </div>
          <label class="vos-field">
            Instructions
            <textarea [(ngModel)]="instructions" name="instructions" rows="2" placeholder="With food, finish the course…"></textarea>
          </label>
          <div class="acts">
            <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">Cancel</button>
            <button type="submit" class="vos-btn" [disabled]="saving()">
              {{ saving() ? 'Saving…' : editingId() ? 'Save changes' : 'Save schedule' }}
            </button>
          </div>
        </form>
      }
    </section>

    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!meds().length) {
      <div class="empty">
        <strong>No medication schedules yet</strong>
        <p>Add one above, or open a completed visit and choose “Add to medication tracking” on the prescription.</p>
        <a class="vos-btn vos-btn-secondary" [routerLink]="petId ? ['/pets', petId, 'health'] : '/health'">Open health record</a>
      </div>
    } @else {
      @for (m of meds(); track m.id) {
        <article class="vos-card" [class.card--stopped]="isStopped(m)">
          <div class="top">
            <h2>{{ m.medicine }}</h2>
            <span class="badge" [class.badge--done]="isStopped(m)">{{ statusLabel(m) }}</span>
          </div>
          <p class="vos-muted">
            {{ titleCase(petLabel(m)) }}
            @if (m.dose || m.frequency) {
              · {{ m.dose }} {{ m.frequency }}
            }
          </p>
          @if (m.instructions) {
            <p class="note">{{ m.instructions }}</p>
          }
          @if (!isStopped(m)) {
            @if (slotsFor(m).length) {
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
            } @else {
              <p class="note">No dose times yet. Edit this schedule and pick morning, afternoon, evening, or night.</p>
            }
            <div class="card-acts">
              <button type="button" class="text-btn" (click)="startEdit(m)">Edit</button>
              <button type="button" class="text-btn text-btn--danger" (click)="stopId.set(m.id)">Stop schedule</button>
            </div>
            @if (stopId() === m.id) {
              <div class="confirm">
                <p>Stop tracking {{ m.medicine }}? Today’s remaining doses will no longer show.</p>
                <div class="acts">
                  <button type="button" class="ghost" (click)="stopId.set('')" [disabled]="saving()">Keep</button>
                  <button type="button" class="vos-btn danger" (click)="stopSchedule(m)" [disabled]="saving()">
                    {{ saving() ? 'Stopping…' : 'Stop' }}
                  </button>
                </div>
              </div>
            }
          }
        </article>
      }
    }
    </vos-health-shell>
  `,
  styles: [`
    .head { margin: 4px 0 16px; }
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h1 { margin: 0; font-size: clamp(1.55rem, 3vw, 2rem); }
    h2 { font-size: 1.1rem; margin: 0; }
    .lede, .hint, .note { color: var(--vos-ink-muted); }
    .lede { margin: 6px 0 0; }
    .hint { margin: 4px 0 0; font-size: 0.9rem; }
    .note { margin: 8px 0 0; font-size: 0.92rem; }
    .panel {
      margin: 0 0 16px;
      padding: 16px;
      border-radius: 16px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
    }
    .panel__row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
    .form { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill {
      min-height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid var(--vos-border);
      background: #fff;
      font: inherit;
      font-weight: 700;
      text-transform: capitalize;
      cursor: pointer;
    }
    .pill.on {
      background: var(--vos-brand-soft);
      border-color: var(--vos-brand);
      color: var(--vos-brand);
    }
    .acts { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
    .ghost {
      min-height: 44px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid var(--vos-border);
      background: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .danger { background: #B42318 !important; }
    .top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .badge {
      font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 8px;
      background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .badge--done { background: #f3f1ec; color: var(--vos-ink-muted); }
    .card--stopped { opacity: 0.72; }
    .slots { display: grid; gap: 8px; margin-top: 10px; }
    .slot-row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; }
    .slot, .skip, .snooze {
      min-height: 44px; border-radius: 12px; border: 1px solid var(--vos-border);
      background: #fff; font-weight: 600; cursor: pointer; padding: 0 10px;
    }
    .slot { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .snooze { color: var(--vos-warning); }
    .card-acts { display: flex; gap: 14px; margin-top: 12px; }
    .text-btn {
      border: 0; background: transparent; padding: 0;
      font: inherit; font-weight: 700; color: var(--vos-ink); cursor: pointer;
    }
    .text-btn--danger { color: #B42318; }
    .confirm {
      margin-top: 12px;
      padding: 12px;
      border-radius: 12px;
      background: #fff5f3;
      border: 1px solid rgba(180, 35, 24, 0.22);
    }
    .confirm p { margin: 0 0 10px; }
    .empty {
      text-align: center;
      padding: 28px 18px;
      border-radius: 16px;
      border: 1px solid var(--vos-border);
      background: #fffef9;
    }
    .empty strong { display: block; font-family: var(--vos-display); margin-bottom: 6px; }
    .empty p { margin: 0 auto 14px; max-width: 46ch; color: var(--vos-ink-muted); }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class MedicationsComponent implements OnInit, OnDestroy {
  readonly meds = signal<any[]>([]);
  readonly pets = signal<any[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  readonly formOpen = signal(false);
  readonly editingId = signal('');
  readonly stopId = signal('');
  readonly petOptions = signal<VosSelectOption[]>([]);
  readonly doseSlots = DOSE_SLOTS;
  petId = '';
  formPetId = '';
  medicine = '';
  strength = '';
  dose = '';
  frequency = '';
  instructions = '';
  times: Record<DoseSlot, boolean> = {
    morning: true,
    afternoon: false,
    evening: false,
    night: false,
  };

  private sub?: Subscription;
  private routed = false;

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id') || '';
      if (this.routed && id === this.petId) return;
      this.routed = true;
      this.petId = id;
      if (this.petId) {
        this.activePet.set(this.petId);
        this.formPetId = this.petId;
      }
      void this.load();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  titleCase = titleCase;

  slotsFor(m: any): string[] {
    const t = m.times || {};
    return DOSE_SLOTS.filter((s) => t[s]);
  }

  logged(m: any, slot: string) {
    return (m.today || []).find((x: any) => x.slot === slot)?.status || '';
  }

  isStopped(m: any): boolean {
    if (m?.active === false) return true;
    return /completed|stopped|inactive|cancelled/i.test(String(m?.status || ''));
  }

  statusLabel(m: any): string {
    if (this.isStopped(m)) return 'STOPPED';
    return String(m?.status || 'ACTIVE');
  }

  petLabel(m: any): string {
    if (m?.petName) return m.petName;
    const pet = this.pets().find((p) => p.id === m?.petId);
    return pet?.name || 'Pet';
  }

  toggleTime(slot: DoseSlot) {
    this.times = { ...this.times, [slot]: !this.times[slot] };
  }

  openCreate() {
    this.editingId.set('');
    this.stopId.set('');
    this.medicine = '';
    this.strength = '';
    this.dose = '';
    this.frequency = '';
    this.instructions = '';
    this.times = { morning: true, afternoon: false, evening: false, night: false };
    this.formPetId = this.petId || this.activePet.get() || this.pets()[0]?.id || '';
    this.formOpen.set(true);
    this.error.set('');
    this.ok.set('');
  }

  startEdit(m: any) {
    this.editingId.set(String(m.id || ''));
    this.stopId.set('');
    this.formPetId = m.petId || this.petId || '';
    this.medicine = m.medicine || '';
    this.strength = m.strength || '';
    this.dose = m.dose || '';
    this.frequency = m.frequency || '';
    this.instructions = m.instructions || '';
    const t = m.times || {};
    this.times = {
      morning: !!t.morning,
      afternoon: !!t.afternoon,
      evening: !!t.evening,
      night: !!t.night,
    };
    if (!DOSE_SLOTS.some((s) => this.times[s])) this.times.morning = true;
    this.formOpen.set(true);
    this.error.set('');
    this.ok.set('');
  }

  closeForm() {
    if (this.saving()) return;
    this.formOpen.set(false);
    this.editingId.set('');
  }

  async load() {
    const id = this.petId || this.activePet.get() || '';
    this.loading.set(true);
    this.error.set('');
    try {
      const [meds, pets] = await Promise.all([
        this.api.medications(id || null),
        this.api.pets().catch(() => []),
      ]);
      if (id !== (this.petId || this.activePet.get() || '')) return;
      this.pets.set(pets || []);
      this.petOptions.set(
        (pets || []).map((p: any) => ({ value: p.id, label: titleCase(p.name || 'Pet') })),
      );
      if (!this.formPetId || (this.petId && this.formPetId !== this.petId)) {
        this.formPetId = this.petId || id || pets?.[0]?.id || '';
      }
      const list = (meds || []).filter((m: any) => {
        if (!id) return true;
        const owner = String(m?.petId || m?.pet?.id || '').trim();
        return !owner || owner === id;
      });
      list.sort((a: any, b: any) => Number(this.isStopped(a)) - Number(this.isStopped(b)));
      this.meds.set(list);
    } catch (e: any) {
      if (id !== (this.petId || this.activePet.get() || '')) return;
      this.error.set(e?.message || 'Failed');
    } finally {
      if (id === (this.petId || this.activePet.get() || '')) this.loading.set(false);
    }
  }

  private scheduleBody() {
    return {
      petId: this.petId || this.formPetId,
      medicine: this.medicine.trim(),
      strength: this.strength.trim(),
      dose: this.dose.trim(),
      frequency: this.frequency.trim(),
      instructions: this.instructions.trim(),
      times: { ...this.times },
      active: true,
      status: 'ACTIVE',
    };
  }

  async saveSchedule() {
    const body = this.scheduleBody();
    if (!body.petId) {
      this.error.set('Choose a pet for this medicine.');
      return;
    }
    if (!body.medicine) {
      this.error.set('Enter the medicine name.');
      return;
    }
    if (!DOSE_SLOTS.some((s) => this.times[s])) {
      this.error.set('Pick at least one dose time.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      if (this.editingId()) {
        await this.api.updateMedication(this.editingId(), body);
        this.ok.set(`Updated ${body.medicine}.`);
      } else {
        await this.api.createMedication(body);
        this.ok.set(`${body.medicine} added to medication tracking.`);
      }
      this.formOpen.set(false);
      this.editingId.set('');
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Could not save medication');
      this.error.set(
        /route not found|missing/i.test(msg)
          ? 'Medication save API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.saving.set(false);
    }
  }

  async stopSchedule(m: any) {
    if (!m?.id || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.updateMedication(String(m.id), {
        status: 'COMPLETED',
        active: false,
        petId: m.petId || this.petId || undefined,
      });
      this.ok.set(`Stopped ${m.medicine || 'this medicine'}.`);
      this.stopId.set('');
      await this.load();
    } catch (e: any) {
      const msg = String(e?.error?.message || e?.message || 'Could not stop medication');
      this.error.set(
        /route not found|missing/i.test(msg)
          ? 'Medication update API is missing on the server. See API_README.md.'
          : msg,
      );
    } finally {
      this.saving.set(false);
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
