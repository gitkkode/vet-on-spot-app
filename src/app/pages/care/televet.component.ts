import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-televet',
  template: `
    <a routerLink="/home" class="vos-back"><span class="vos-back__chev" aria-hidden="true">‹</span> Home</a>
    <header class="head">
      <p class="eyebrow">Remote care</p>
      <h1>Talk to a Vet</h1>
      <p class="vos-muted">
        Request a remote consultation for appropriate cases. Live video is not available yet —
        a veterinarian will review your request.
      </p>
    </header>

    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @if (error()) { <div class="vos-err">{{ error() }}</div> }

    <form class="panel" (ngSubmit)="submit()">
      <div class="field">
        <p class="label">Which pet? <span class="req" aria-hidden="true">*</span></p>
        @if (selectedPetName()) {
          <p class="context">Booking for <strong>{{ selectedPetName() }}</strong></p>
        }
        <div class="pills" role="group" aria-label="Pets">
          @for (p of pets(); track p.id) {
            <button
              type="button"
              class="pill"
              [class.on]="petId() === p.id"
              [attr.aria-pressed]="petId() === p.id"
              (click)="pickPet(p.id)"
            >
              <span class="pill__mono">{{ petInitial(p.name) }}</span>
              <span class="pill__text">
                <strong>{{ displayName(p.name) }}</strong>
                @if (p.species) { <em>{{ p.species }}</em> }
              </span>
            </button>
          }
        </div>
        @if (!pets().length && !booting()) {
          <p class="vos-empty">Add a pet first.</p>
          <a class="vos-btn vos-btn-secondary" routerLink="/pets/new">Add a pet</a>
        }
        @if (fieldError() === 'pet') {
          <span class="field-err">Select a pet to continue</span>
        }
      </div>

      <label class="field">
        <span class="label">Reason <span class="req" aria-hidden="true">*</span></span>
        <textarea
          [(ngModel)]="reason"
          name="reason"
          rows="3"
          required
          placeholder="What would you like to discuss?"
          (ngModelChange)="onReasonChange()"
        ></textarea>
        @if (fieldError() === 'reason') {
          <span class="field-err">Please enter a reason for the consultation</span>
        }
      </label>

      <div class="field">
        <p class="label">When?</p>
        <div class="pills pills--modes" role="group" aria-label="Timing">
          <button
            type="button"
            class="pill pill--mode"
            [class.on]="mode === 'immediate'"
            (click)="mode = 'immediate'"
          >Immediate</button>
          <button
            type="button"
            class="pill pill--mode"
            [class.on]="mode === 'scheduled'"
            (click)="mode = 'scheduled'"
          >Scheduled</button>
        </div>
      </div>

      @if (mode === 'scheduled') {
        <div class="sched">
          <label class="field">
            <span class="label">Preferred date</span>
            <input type="date" [(ngModel)]="preferredDate" name="preferredDate" />
          </label>
          <label class="field">
            <span class="label">Preferred time</span>
            <input type="time" [(ngModel)]="preferredTime" name="preferredTime" />
          </label>
        </div>
      }

      <div class="vos-warn note">
        Tele-vet is not a substitute for emergency care. Some conditions need an in-person exam.
      </div>

      <div class="actions">
        <button class="vos-btn" type="submit" [disabled]="!canSubmit() || saving()">
          {{ saving() ? 'Submitting…' : 'Request tele-vet' }}
        </button>
      </div>
    </form>

    <section class="history" aria-label="Tele-vet history">
      <h2>Your tele-vet requests</h2>
      @if (loadingList()) {
        <div class="vos-skel"></div>
      } @else if (!list().length) {
        <p class="vos-empty">No tele-vet requests yet.</p>
      } @else {
        <div class="history__list">
          @for (b of list(); track b.id) {
            <article class="hist-card">
              <div class="hist-card__top">
                <div>
                  <strong>{{ displayName(b.petName) || 'Pet' }}</strong>
                  <p class="hist-card__reason">{{ b.reason || 'Consultation' }}</p>
                </div>
                <span class="vos-badge">{{ b.customerStatus?.label || b.status }}</span>
              </div>
              <p class="hist-card__when">{{ prettyWhen(b.scheduledDate, b.scheduledTime) }}</p>
              <a class="hist-card__link" [routerLink]="['/bookings', b.id]">View booking →</a>

              @if (pendingHomeVisit(b); as rec) {
                <div class="rec">
                  <p><strong>Home visit recommended</strong></p>
                  <p class="vos-muted">{{ rec.reason || 'Your veterinarian recommends an in-person visit.' }}</p>
                  <button
                    type="button"
                    class="vos-btn vos-btn-accent"
                    [disabled]="confirming()===b.id"
                    (click)="confirm(b.id)"
                  >
                    {{ confirming()===b.id ? 'Confirming…' : 'Confirm home visit' }}
                  </button>
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .head { margin-bottom: 18px; }
    .eyebrow {
      margin: 0 0 4px; color: var(--vos-brand); letter-spacing: 0.12em;
      text-transform: uppercase; font-size: 11px; font-weight: 700;
      font-family: var(--vos-mono);
    }
    h1 {
      font-family: var(--vos-display); margin: 0 0 8px;
      font-size: clamp(1.7rem, 4vw, 2.2rem); letter-spacing: -0.03em;
    }
    h2 {
      font-size: 1.15rem; margin: 0 0 14px; font-family: var(--vos-display);
      letter-spacing: -0.02em;
    }
    .panel {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 22px 20px;
      box-shadow: 0 12px 32px rgba(20, 16, 12, 0.05);
      margin-bottom: 28px;
      display: grid;
      gap: 18px;
    }
    .label {
      display: block; margin: 0 0 8px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--vos-ink-muted); font-weight: 700; font-family: var(--vos-mono);
    }
    .req { color: var(--vos-brand); font-weight: 800; }
    .context {
      margin: -2px 0 10px; font-size: 0.95rem; color: var(--vos-ink-muted);
    }
    .context strong { color: var(--vos-ink); }
    .field { display: block; }
    .field textarea, .field input {
      width: 100%; box-sizing: border-box;
      padding: 14px 16px; border-radius: 14px;
      border: 1px solid var(--vos-border); background: #faf8f4;
      font: inherit; font-size: 1.02rem; color: var(--vos-ink);
      min-height: 52px;
    }
    .field textarea { min-height: 96px; resize: vertical; line-height: 1.45; }
    .field textarea:focus, .field input:focus {
      outline: none; background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }
    .field-err {
      display: block; margin-top: 8px;
      font-size: 0.88rem; font-weight: 600; color: #b42318;
    }

    .pills {
      display: flex; flex-wrap: wrap; gap: 10px;
    }
    .pill {
      display: inline-flex; align-items: center; gap: 10px;
      width: auto; max-width: 100%;
      text-align: left; margin: 0; padding: 10px 14px 10px 10px;
      border-radius: 999px; border: 1px solid var(--vos-border);
      background: #fff; cursor: pointer; color: var(--vos-ink);
      font: inherit; box-shadow: 0 2px 8px rgba(10, 10, 10, 0.03);
    }
    .pill:hover { border-color: rgba(253, 74, 41, 0.35); }
    .pill.on {
      border-color: var(--vos-brand);
      background: var(--vos-brand-soft);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.12);
    }
    .pill__mono {
      width: 32px; height: 32px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: #fff; color: var(--vos-brand);
      font-family: var(--vos-display); font-weight: 700; flex-shrink: 0;
    }
    .pill.on .pill__mono { background: #fff; }
    .pill__text { display: grid; gap: 1px; min-width: 0; }
    .pill__text strong {
      font-size: 0.95rem; font-weight: 700; line-height: 1.2;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pill__text em {
      font-style: normal; font-size: 0.78rem; color: var(--vos-ink-muted);
    }
    .pills--modes { gap: 8px; }
    .pill--mode {
      padding: 12px 20px;
      font-weight: 700;
      border-radius: 14px;
    }
    .pill--mode .pill__mono { display: none; }

    .sched {
      display: grid; gap: 12px;
      grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 560px) {
      .sched { grid-template-columns: 1fr; }
    }

    .note { margin: 0; font-size: 0.92rem; }
    .actions {
      display: flex; justify-content: flex-start;
    }
    .actions .vos-btn {
      width: auto; min-width: 180px; max-width: 100%;
      margin: 0;
    }
    .actions .vos-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .history { margin-bottom: 32px; }
    .history__list { display: grid; gap: 12px; }
    .hist-card {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 18px;
      padding: 16px 18px;
      box-shadow: 0 8px 22px rgba(20, 16, 12, 0.04);
    }
    .hist-card__top {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
    }
    .hist-card__top strong {
      font-family: var(--vos-display); font-size: 1.08rem; letter-spacing: -0.02em;
    }
    .hist-card__reason {
      margin: 4px 0 0; color: var(--vos-ink-muted); font-size: 0.95rem; line-height: 1.4;
    }
    .hist-card__when {
      margin: 10px 0 0;
      font-family: var(--vos-mono); font-size: 11px;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 600;
    }
    .hist-card__link {
      display: inline-block; margin-top: 10px;
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .hist-card__link:hover { text-decoration: underline; }
    .rec {
      margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--vos-border);
    }
    .rec .vos-btn { margin-top: 8px; width: auto; }
  `],
})
export class TelevetComponent implements OnInit {
  reason = '';
  mode: 'immediate' | 'scheduled' = 'immediate';
  preferredDate = '';
  preferredTime = '';

  readonly petId = signal('');
  readonly pets = signal<any[]>([]);
  readonly list = signal<any[]>([]);
  readonly loadingList = signal(true);
  readonly booting = signal(true);
  readonly saving = signal(false);
  readonly confirming = signal('');
  readonly error = signal('');
  readonly ok = signal('');
  readonly fieldError = signal('');

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const preferred =
      this.route.snapshot.queryParamMap.get('petId') || this.activePet.get() || '';
    if (preferred) this.petId.set(preferred);
    void this.bootstrap(preferred);
  }

  async bootstrap(preferredId: string) {
    this.booting.set(true);
    try {
      const pets = await this.api.pets();
      this.pets.set(pets || []);
      const resolved = this.activePet.syncFromPets(pets || [], preferredId || this.petId());
      if (resolved) this.petId.set(resolved);
    } catch {
      /* ignore */
    } finally {
      this.booting.set(false);
    }
    await this.loadList();
  }

  pickPet(id: string) {
    this.petId.set(id);
    this.activePet.set(id);
    if (this.fieldError() === 'pet') this.fieldError.set('');
  }

  selectedPetName() {
    const id = this.petId();
    if (!id) return '';
    const p = this.pets().find((x) => x.id === id);
    return this.displayName(p?.name);
  }

  displayName(name: string | null | undefined) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  petInitial(name: string | null | undefined) {
    return (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  }

  onReasonChange() {
    if (this.fieldError() === 'reason' && this.reason.trim()) this.fieldError.set('');
  }

  canSubmit() {
    return !!(this.petId() && this.reason.trim());
  }

  prettyWhen(dateStr?: string | null, timeStr?: string | null) {
    const time = String(timeStr || '').trim();
    if (!dateStr) return time || 'Time TBD';
    const raw = String(dateStr);
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return `${raw}${time ? ` · ${time}` : ''}`.trim();
    const day = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return time ? `${day} · ${time}` : day;
  }

  pendingHomeVisit(b: any) {
    const rec = b?.details?.homeVisitRecommendation;
    if (rec?.status === 'pending_customer') return rec;
    return null;
  }

  async loadList() {
    this.loadingList.set(true);
    try {
      const raw = await this.api.televetList();
      this.list.set(Array.isArray(raw) ? raw : raw?.items || []);
    } catch {
      this.list.set([]);
    } finally {
      this.loadingList.set(false);
    }
  }

  async submit() {
    if (!this.petId()) {
      this.fieldError.set('pet');
      this.error.set('Select a pet to continue.');
      return;
    }
    if (!this.reason.trim()) {
      this.fieldError.set('reason');
      this.error.set('Please enter a reason for the consultation.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    this.fieldError.set('');
    try {
      const body: Record<string, unknown> = {
        petId: this.petId(),
        reason: this.reason.trim(),
        mode: this.mode,
      };
      if (this.mode === 'scheduled') {
        if (this.preferredDate) body['preferredDate'] = this.preferredDate;
        if (this.preferredTime) body['preferredTime'] = this.preferredTime;
      }
      const row = await this.api.createTelevet(body);
      this.ok.set(
        row.disclaimer ||
          `Tele-vet request ${row.id} submitted. Live video is deferred — a vet will review your case.`,
      );
      this.reason = '';
      await this.loadList();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not submit tele-vet request');
    } finally {
      this.saving.set(false);
    }
  }

  async confirm(bookingId: string) {
    this.confirming.set(bookingId);
    this.error.set('');
    this.ok.set('');
    try {
      const row = await this.api.confirmHomeVisit(bookingId);
      const homeId = row.homeBooking?.id;
      this.ok.set(
        homeId
          ? `Home visit ${homeId} created from your tele-vet recommendation.`
          : 'Home visit booking created.',
      );
      await this.loadList();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not confirm home visit');
    } finally {
      this.confirming.set('');
    }
  }
}
