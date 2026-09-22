import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

const CATEGORIES = [
  'Breathing difficulty',
  'Severe bleeding',
  'Accident/trauma',
  'Seizure',
  'Poisoning',
  'Collapse/unconscious',
  'Severe pain',
  'Possible obstruction',
  'Other',
];

type TriState = boolean | null;

type QuickKey = 'conscious' | 'breathingNormally' | 'bleeding' | 'possiblePoisoning' | 'accident';

const QUICK_CHECKS: { key: QuickKey; label: string }[] = [
  { key: 'conscious', label: 'Conscious' },
  { key: 'breathingNormally', label: 'Breathing normally' },
  { key: 'bleeding', label: 'Bleeding' },
  { key: 'possiblePoisoning', label: 'Possible poisoning' },
  { key: 'accident', label: 'Accident / trauma' },
];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-emergency',
  template: `
    <a routerLink="/home" class="vos-back"><span class="vos-back__chev" aria-hidden="true">‹</span> Home</a>
    <header class="head">
      <p class="eyebrow">Urgent care</p>
      <h1>Something is wrong</h1>
      <p class="vos-muted">
        Tell us what’s happening so we can connect you to care. This does not auto-dispatch a veterinarian.
      </p>
    </header>

    @if (submitted(); as s) {
      <div class="vos-ok success">
        <p><strong>Request {{ s.displayId }} received</strong></p>
        <p>{{ s.disclaimer || 'A care request was created. Seek local emergency services if immediate hospital care is needed.' }}</p>
        @if (s.bookingId) {
          <a class="vos-btn" [routerLink]="['/bookings', s.bookingId, 'track']">Track care request</a>
          <a class="vos-btn vos-btn-secondary" [routerLink]="['/emergencies', s.displayId || s.id]">View emergency status</a>
        } @else {
          <a class="vos-btn" [routerLink]="['/emergencies', s.displayId || s.id]">View emergency status</a>
        }
      </div>
    } @else {
      @if (error()) { <div class="vos-err">{{ error() }}</div> }

      <nav class="phases" aria-label="Emergency steps">
        <button type="button" class="phase" [class.on]="phase() === 1" (click)="phase.set(1)">1 · What’s wrong</button>
        <button type="button" class="phase" [class.on]="phase() === 2" [disabled]="!canGoDetails()" (click)="goPhase(2)">2 · Details</button>
        <button type="button" class="phase" [class.on]="phase() === 3" [disabled]="!canGoContact()" (click)="goPhase(3)">3 · Contact</button>
      </nav>

      @if (phase() === 1) {
        <section class="card">
          <p class="label">Which pet? <span class="req">*</span></p>
          @if (selectedPetName()) {
            <p class="context">Caring for <strong>{{ selectedPetName() }}</strong></p>
          }
          <div class="pills">
            @for (p of pets(); track p.id) {
              <button type="button" class="pill" [class.on]="petId===p.id" (click)="pickPet(p.id)">
                <span class="pill__mono">{{ petInitial(p.name) }}</span>
                <span>
                  <strong>{{ displayName(p.name) }}</strong>
                  @if (p.species) { <em>{{ p.species }}</em> }
                </span>
              </button>
            }
          </div>
          @if (!pets().length) {
            <p class="vos-empty">Add a pet first.</p>
            <a class="vos-btn vos-btn-secondary" routerLink="/pets/new">Add a pet</a>
          }
        </section>

        <section class="card">
          <p class="label">What’s wrong? <span class="req">*</span></p>
          <p class="hint">Pick the closest match — you can add detail next.</p>
          <div class="cats">
            @for (c of categories; track c) {
              <button type="button" class="cat" [class.on]="category===c" (click)="pickCategory(c)">{{ c }}</button>
            }
          </div>
          <div class="nav-row">
            <button type="button" class="vos-btn" [disabled]="!canGoDetails()" (click)="goPhase(2)">Continue</button>
          </div>
        </section>
      }

      @if (phase() === 2) {
        <section class="card">
          <div class="card__head">
            <div>
              <p class="label">Location &amp; story</p>
              <p class="hint">Where you are and what happened.</p>
            </div>
            <button type="button" class="linkish" (click)="phase.set(1)">Change symptom</button>
          </div>
          <div class="fields">
            <label class="field">
              <span class="field__label">Where are you?</span>
              <input [(ngModel)]="location" name="location" placeholder="Address or landmark" />
            </label>
            <label class="field">
              <span class="field__label">What happened? <span class="req">*</span></span>
              <textarea [(ngModel)]="whatHappened" name="whatHappened" rows="3" placeholder="Brief description"></textarea>
            </label>
            <label class="field">
              <span class="field__label">When did this start?</span>
              <input [(ngModel)]="whenStarted" name="whenStarted" placeholder="e.g. 20 minutes ago" />
            </label>
          </div>
        </section>

        <section class="card card--checks">
          <p class="label">Quick checks</p>
          <p class="hint">Tap Yes / No / Unsure for each — optional but helpful.</p>
          <div class="checks" role="group" aria-label="Quick checks">
            @for (q of quickChecks; track q.key) {
              <div class="check-row">
                <span class="check-row__label">{{ q.label }}</span>
                <div class="seg" role="group" [attr.aria-label]="q.label">
                  <button type="button" [class.on]="getQuick(q.key)===true" (click)="setQuick(q.key, true)">Yes</button>
                  <button type="button" [class.on]="getQuick(q.key)===false" (click)="setQuick(q.key, false)">No</button>
                  <button type="button" [class.on]="getQuick(q.key)===null" (click)="setQuick(q.key, null)">Unsure</button>
                </div>
              </div>
            }
          </div>
          <div class="nav-row">
            <button type="button" class="vos-btn vos-btn-secondary" (click)="phase.set(1)">Back</button>
            <button type="button" class="vos-btn" [disabled]="!canGoContact()" (click)="goPhase(3)">Continue</button>
          </div>
        </section>
      }

      @if (phase() === 3) {
        <section class="card">
          <p class="label">Contact</p>
          <div class="fields">
            <label class="field">
              <span class="field__label">Phone</span>
              <input [(ngModel)]="phone" name="phone" type="tel" autocomplete="tel" />
            </label>
            <label class="field">
              <span class="field__label">Notes <em>(optional)</em></span>
              <textarea [(ngModel)]="notes" name="notes" rows="2" placeholder="Anything else the care team should know"></textarea>
            </label>
          </div>
        </section>

        <div class="vos-warn disclaimer">
          <label class="ack">
            <input type="checkbox" [(ngModel)]="safetyAck" name="safetyAck" />
            <span>
              If your pet needs immediate hospital care and VetonSpot cannot reach you in time,
              seek local emergency veterinary assistance. Submitting does not guarantee instant dispatch.
            </span>
          </label>
        </div>

        <div class="nav-row nav-row--end">
          <button type="button" class="vos-btn vos-btn-secondary" (click)="phase.set(2)">Back</button>
          <button
            class="vos-btn danger-btn"
            type="button"
            [disabled]="!canSubmit() || saving()"
            (click)="submit()"
          >
            {{ saving() ? 'Sending…' : 'Request urgent help' }}
          </button>
        </div>
        <a class="alt-link" routerLink="/book/new" [queryParams]="{petId: petId || null}">
          Not urgent? Book a visit instead
        </a>
      }
    }
  `,
  styles: [`
    .head { margin-bottom: 16px; max-width: 48ch; }
    .eyebrow {
      margin: 0 0 4px; color: var(--vos-danger, #c62828); letter-spacing: 0.12em;
      text-transform: uppercase; font-size: 11px; font-weight: 700; font-family: var(--vos-mono);
    }
    h1 {
      font-family: var(--vos-display); margin: 0 0 8px;
      font-size: clamp(1.7rem, 4vw, 2.2rem); letter-spacing: -0.03em;
    }
    .phases {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .phase {
      border: 1px solid var(--vos-border); background: #fff; color: var(--vos-ink-muted);
      border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 0.85rem;
      font-weight: 700; cursor: pointer;
    }
    .phase.on {
      background: #0a0a0a; color: #fff; border-color: #0a0a0a;
    }
    .phase:disabled { opacity: 0.4; cursor: not-allowed; }

    .card {
      background: #fff; border: 1px solid var(--vos-border); border-radius: 20px;
      padding: 20px 18px; margin-bottom: 16px;
      box-shadow: 0 10px 28px rgba(20, 16, 12, 0.04);
    }
    .card__head {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      margin-bottom: 14px;
    }
    .card__head .label { margin-bottom: 4px; }
    .label {
      margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--vos-ink-muted); font-weight: 700; font-family: var(--vos-mono);
    }
    .req { color: var(--vos-danger, #c62828); }
    .hint { margin: 0 0 12px; font-size: 0.92rem; color: var(--vos-ink-muted); line-height: 1.4; }
    .context { margin: 0 0 10px; font-size: 0.95rem; color: var(--vos-ink-muted); }
    .context strong { color: var(--vos-ink); }
    .linkish {
      border: 0; background: none; color: var(--vos-brand); font: inherit;
      font-weight: 700; font-size: 0.88rem; cursor: pointer; text-decoration: underline;
      text-underline-offset: 2px; white-space: nowrap;
    }

    .pills { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 10px 14px 10px 10px; border-radius: 999px;
      border: 1px solid var(--vos-border); background: #fff;
      cursor: pointer; font: inherit; color: var(--vos-ink); text-align: left;
    }
    .pill.on {
      border-color: var(--vos-danger, #c62828); background: #fdecec;
      box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.1);
    }
    .pill__mono {
      width: 32px; height: 32px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: #fff; color: var(--vos-danger, #c62828);
      font-family: var(--vos-display); font-weight: 700;
    }
    .pill span { display: grid; gap: 1px; }
    .pill strong { font-size: 0.95rem; }
    .pill em { font-style: normal; font-size: 0.78rem; color: var(--vos-ink-muted); }

    .cats { display: flex; flex-wrap: wrap; gap: 8px; }
    .cat {
      border: 1px solid var(--vos-border); background: #fff; color: var(--vos-ink);
      border-radius: 12px; padding: 10px 14px; font: inherit; font-size: 0.9rem;
      font-weight: 600; cursor: pointer;
    }
    .cat.on {
      border-color: var(--vos-danger, #c62828); background: #fdecec; font-weight: 700;
    }

    .fields { display: grid; gap: 16px; }
    .field { display: block; }
    .field__label {
      display: block; margin-bottom: 8px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--vos-ink-muted); font-family: var(--vos-mono);
    }
    .field__label em {
      font-style: normal; text-transform: none; letter-spacing: 0;
      font-weight: 600; color: #9a968e; font-family: var(--vos-font); font-size: 0.85rem;
    }
    .field input, .field textarea {
      width: 100%; box-sizing: border-box; padding: 14px 16px; border-radius: 14px;
      border: 1px solid var(--vos-border); background: #faf8f4;
      font: inherit; font-size: 1.02rem; color: var(--vos-ink); min-height: 52px;
    }
    .field textarea { min-height: 96px; resize: vertical; line-height: 1.45; }
    .field input:focus, .field textarea:focus {
      outline: none; background: #fff;
      border-color: rgba(198, 40, 40, 0.4);
      box-shadow: 0 0 0 4px rgba(198, 40, 40, 0.1);
    }

    .card--checks { margin-top: 4px; }
    .checks {
      border: 1px solid var(--vos-border); border-radius: 14px; overflow: hidden;
      background: #faf8f4;
    }
    .check-row {
      display: grid; grid-template-columns: minmax(0, 1.2fr) auto;
      gap: 10px; align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vos-border);
    }
    .check-row:last-child { border-bottom: 0; }
    .check-row__label {
      font-size: 0.92rem; font-weight: 600; color: var(--vos-ink);
    }
    .seg {
      display: inline-flex; border: 1px solid var(--vos-border); border-radius: 10px;
      overflow: hidden; background: #fff;
    }
    .seg button {
      border: 0; background: transparent; padding: 7px 11px;
      font: inherit; font-size: 0.8rem; font-weight: 700;
      color: var(--vos-ink-muted); cursor: pointer; min-width: 58px;
    }
    .seg button + button { border-left: 1px solid var(--vos-border); }
    .seg button.on {
      background: #0a0a0a; color: #fff;
    }
    @media (max-width: 520px) {
      .check-row { grid-template-columns: 1fr; gap: 8px; }
      .seg { width: 100%; }
      .seg button { flex: 1; }
    }

    .disclaimer { margin: 0 0 16px; }
    .ack {
      display: flex; gap: 10px; align-items: flex-start; font-size: 0.92rem; cursor: pointer;
    }
    .ack input { margin-top: 4px; flex-shrink: 0; }

    .nav-row {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end;
      margin-top: 18px;
    }
    .nav-row--end { margin-bottom: 12px; }
    .nav-row .vos-btn { width: auto; min-width: 140px; margin: 0; }
    .danger-btn { background: var(--vos-danger, #c62828) !important; }
    .alt-link {
      display: inline-block; margin-bottom: 28px;
      font-weight: 700; color: var(--vos-ink-muted); text-decoration: none;
    }
    .alt-link:hover { color: var(--vos-brand); }
    .success .vos-btn { margin-top: 10px; margin-right: 8px; width: auto; }
  `],
})
export class EmergencyComponent implements OnInit {
  categories = CATEGORIES;
  quickChecks = QUICK_CHECKS;
  petId = '';
  category = '';
  location = '';
  whatHappened = '';
  whenStarted = '';
  conscious: TriState = null;
  breathingNormally: TriState = null;
  bleeding: TriState = null;
  possiblePoisoning: TriState = null;
  accident: TriState = null;
  phone = '';
  notes = '';
  safetyAck = false;

  readonly phase = signal(1);
  readonly pets = signal<any[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly submitted = signal<any>(null);

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.queryParamMap.get('petId') || this.activePet.get() || '';
    void this.bootstrap();
  }

  async bootstrap() {
    try {
      const preferred = this.petId;
      const [pets, me] = await Promise.all([this.api.pets(), this.api.me().catch(() => null)]);
      this.pets.set(pets || []);
      const resolved = this.activePet.syncFromPets(pets || [], preferred);
      if (resolved) this.petId = resolved;
      if (me) {
        this.phone = me.mobile || me.phone || '';
        this.location = me.address || '';
      }
    } catch {
      /* ignore */
    }
  }

  pickPet(id: string) {
    this.petId = id;
    this.activePet.set(id);
  }

  pickCategory(c: string) {
    this.category = c;
  }

  goPhase(n: number) {
    if (n === 2 && !this.canGoDetails()) return;
    if (n === 3 && !this.canGoContact()) return;
    this.phase.set(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  canGoDetails() {
    return !!(this.petId && this.category);
  }

  canGoContact() {
    return !!(this.canGoDetails() && this.whatHappened.trim());
  }

  getQuick(key: QuickKey): TriState {
    return this[key];
  }

  setQuick(key: QuickKey, value: TriState) {
    this[key] = value;
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

  selectedPetName() {
    const p = this.pets().find((x) => x.id === this.petId);
    return this.displayName(p?.name);
  }

  canSubmit() {
    return !!(this.petId && this.category && this.whatHappened.trim() && this.safetyAck);
  }

  async submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const row = await this.api.createEmergency({
        petId: this.petId,
        category: this.category,
        whatHappened: this.whatHappened.trim(),
        location: this.location.trim() || undefined,
        whenStarted: this.whenStarted.trim() || undefined,
        conscious: this.conscious,
        breathingNormally: this.breathingNormally,
        bleeding: this.bleeding,
        possiblePoisoning: this.possiblePoisoning,
        accident: this.accident,
        phone: this.phone.trim() || undefined,
        notes: this.notes.trim() || undefined,
        safetyAck: true,
      });
      this.submitted.set(row);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not submit emergency request');
    } finally {
      this.saving.set(false);
    }
  }
}
