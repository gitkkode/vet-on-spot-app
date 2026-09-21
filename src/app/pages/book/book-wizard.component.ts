import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { AuthService } from '../../services/auth.service';
const REASONS = [
  'sick',
  'vomiting / diarrhea',
  'not eating',
  'injury / limping',
  'skin / itching',
  'ear / eye',
  'dental',
  'vaccination',
  'routine checkup',
  'follow-up',
  'other',
];

const INTAKE: Record<string, { label: string; placeholder: string }[]> = {
  sick: [
    { label: 'What have you noticed?', placeholder: 'Lethargy, feverish, coughing…' },
    { label: 'When did it start?', placeholder: 'e.g. yesterday evening' },
  ],
  'vomiting / diarrhea': [
    { label: 'How often?', placeholder: 'Once / several times today' },
    { label: 'Any blood or unusual color?', placeholder: 'Describe if yes' },
  ],
  'not eating': [
    { label: 'Last normal meal?', placeholder: 'When and what' },
    { label: 'Still drinking water?', placeholder: 'Yes / a little / no' },
  ],
  'injury / limping': [
    { label: 'Which area?', placeholder: 'Leg, paw, head…' },
    { label: 'Can they bear weight?', placeholder: 'Yes / with difficulty / no' },
  ],
  'skin / itching': [
    { label: 'Where on the body?', placeholder: 'Ears, belly, paws…' },
    { label: 'Any hair loss or sores?', placeholder: 'Describe' },
  ],
  'ear / eye': [
    { label: 'Which side?', placeholder: 'Left / right / both' },
    { label: 'Discharge or odor?', placeholder: 'Describe' },
  ],
  dental: [
    { label: 'Breath / chewing issues?', placeholder: 'Describe' },
    { label: 'Visible broken tooth or swelling?', placeholder: 'Yes / no / unsure' },
  ],
  vaccination: [{ label: 'Which vaccines needed?', placeholder: 'e.g. annual boosters' }],
  'routine checkup': [{ label: 'Anything you want checked?', placeholder: 'Optional notes' }],
  'follow-up': [{ label: 'What is this follow-up for?', placeholder: 'Prior visit or condition' }],
  other: [{ label: 'Tell us more', placeholder: 'What would you like help with?' }],
};

const STEP_TITLES: Record<number, { title: string; sub: string }> = {
  1: { title: 'Who needs care?', sub: 'Pick the pet this visit is for.' },
  2: { title: 'What’s going on?', sub: 'A quick reason helps us prepare the right vet.' },
  3: { title: 'A little more detail', sub: 'Optional context — not a diagnosis.' },
  4: { title: 'Where should we come?', sub: 'Home visits happen at your place.' },
  5: { title: 'When works?', sub: 'We’ll confirm the slot with the care team.' },
  6: {
    title: 'Looking good?',
    sub: 'We’ll match the best available vet nearby — no picking required.',
  },
};

const TIME_SLOTS = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '2:00 PM',
  '4:00 PM',
  '6:00 PM',
  '8:00 PM',
];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-book-wizard',
  template: `
    <a routerLink="/" class="vos-back"><span class="vos-back__chev" aria-hidden="true">‹</span> Home</a>

    <header class="head">
      <p class="head__kicker">Book a home visit</p>
      <h1>{{ meta().title }}</h1>
      <p class="head__sub">{{ meta().sub }}</p>
      <div class="progress" role="progressbar" [attr.aria-valuenow]="step()" aria-valuemin="1" aria-valuemax="6">
        <span [style.width.%]="(step() / 6) * 100"></span>
      </div>
      <p class="progress__label">Step {{ step() }} of 6</p>
    </header>

    @if (error()) {
      <div class="vos-err" role="alert">
        {{ error() }}
        @if (sessionExpired()) {
          <a routerLink="/login" class="err-link">Sign in again</a>
        } @else {
          <button type="button" class="err-link" (click)="reload()">Try again</button>
        }
      </div>
    }

    @if (booting()) {
      <div class="panel panel--boot" aria-busy="true" aria-label="Loading pets">
        <div class="vos-skel vos-skel--gloss boot-row"></div>
        <div class="vos-skel vos-skel--gloss boot-row"></div>
        <div class="vos-skel vos-skel--gloss boot-row boot-row--short"></div>
      </div>
    } @else {
      <div class="panel">
        @if (step() === 1) {
          @if (sessionExpired()) {
            <div class="empty-state">
              <p class="empty-state__title">Sign in to continue</p>
              <p class="empty">Your session ended — sign in again and we’ll bring you back to booking.</p>
              <a class="btn" routerLink="/login">Sign in</a>
            </div>
          } @else if (!pets().length) {
            <div class="empty-state">
              <p class="empty-state__title">Add a pet first</p>
              <p class="empty">Create a pet profile so we can book the right home visit.</p>
              <a class="btn" routerLink="/pets/new">Add a pet</a>
            </div>
          } @else {
            <div class="chips">
              @for (p of pets(); track p.id) {
                <button type="button" class="chip" [class.on]="petId === p.id" (click)="pickPet(p.id)">
                  <span class="chip__mono">{{ (p.name || '?').charAt(0) }}</span>
                  <span>
                    <strong>{{ p.name }}</strong>
                    <em>{{ p.species || 'Pet' }}</em>
                  </span>
                </button>
              }
            </div>
          }
          <div class="nav">
            <button type="button" class="btn" [disabled]="!petId || sessionExpired()" (click)="go(2)">Continue</button>
          </div>
        }

        @if (step() === 2) {
          <div class="pills">
            @for (r of reasons; track r) {
              <button type="button" class="pill" [class.on]="reason === r" (click)="onReason(r)">
                {{ pretty(r) }}
              </button>
            }
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(1)">Back</button>
            <button type="button" class="btn" [disabled]="!reason" (click)="go(3)">Continue</button>
          </div>
        }

        @if (step() === 3) {
          <div class="fields">
            @for (q of intakeQs(); track q.label; let i = $index) {
              <label class="field">
                <span class="field__label">{{ q.label }}</span>
                <textarea [(ngModel)]="intakeAnswers[i]" [name]="'iq' + i" rows="2" [placeholder]="q.placeholder"></textarea>
              </label>
            }
            <label class="field">
              <span class="field__label">Anything else?</span>
              <textarea [(ngModel)]="intakeExtra" name="intakeExtra" rows="2" placeholder="Optional notes"></textarea>
            </label>
            <div class="field">
              <span class="field__label">Photo <em>(optional)</em></span>
              <label class="upload" [class.upload--has]="!!photoPreview()">
                <input type="file" accept="image/*" (change)="onPhoto($event)" />
                @if (photoPreview()) {
                  <img class="upload__preview" [src]="photoPreview()" alt="Selected photo" />
                  <span class="upload__change">Change photo</span>
                } @else {
                  <span class="upload__icon" aria-hidden="true">＋</span>
                  <strong>Add a photo</strong>
                  <em>Helps the vet prepare before arriving</em>
                }
              </label>
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(2)">Back</button>
            <button type="button" class="btn" (click)="go(4)">Continue</button>
          </div>
        }

        @if (step() === 4) {
          @if (addresses().length) {
            <p class="hint">Saved places</p>
            <div class="chips">
              @for (a of addresses(); track a.id) {
                <button type="button" class="chip chip--block" [class.on]="address === a.address" (click)="pickAddress(a)">
                  <strong>{{ a.label || 'Home' }}</strong>
                  <em>{{ a.address }}</em>
                </button>
              }
            </div>
          }
          <label class="field">
            <span class="field__label">Address</span>
            <textarea [(ngModel)]="address" name="address" rows="3" required placeholder="Flat, street, landmark"></textarea>
          </label>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(3)">Back</button>
            <button type="button" class="btn" [disabled]="!address.trim()" (click)="go(5)">Continue</button>
          </div>
        }

        @if (step() === 5) {
          <div class="fields">
            <label class="field">
              <span class="field__label">Date</span>
              <input type="date" [(ngModel)]="preferredDate" name="preferredDate" [min]="minDate" />
            </label>
            <div class="field">
              <span class="field__label">Time</span>
              <div class="pills">
                @for (t of timeSlots; track t) {
                  <button type="button" class="pill" [class.on]="preferredTime === t" (click)="preferredTime = t">
                    {{ t }}
                  </button>
                }
              </div>
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(4)">Back</button>
            <button type="button" class="btn" [disabled]="!preferredDate || !preferredTime" (click)="go(6)">Review</button>
          </div>
        }

        @if (step() === 6) {
          <div class="review">
            <div><em>Pet</em><strong>{{ petName() }}</strong></div>
            <div><em>Reason</em><strong>{{ pretty(reason) }}</strong></div>
            <div><em>Details</em><strong>{{ intakeText() || '—' }}</strong></div>
            <div><em>Where</em><strong>{{ address }}</strong></div>
            <div><em>When</em><strong>{{ preferredDate }} · {{ preferredTime }}</strong></div>
            <div>
              <em>Doctor</em>
              <strong>Best available match — assigned by our care team</strong>
            </div>
            <div class="review__pay">
              <em>Payment</em>
              <strong>Pay later</strong>
              <span>You’ll pay when the veterinarian arrives at home — nothing charged to book.</span>
            </div>
          </div>
          <div class="nav">
            <button type="button" class="ghost" (click)="go(5)">Back</button>
            <button type="button" class="btn" [disabled]="submitting()" (click)="confirm()">
              @if (submitting()) {
                <span class="spin" aria-hidden="true"></span>
                Booking…
              } @else {
                Confirm visit
              }
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .head { margin-bottom: 18px; animation: rise 0.4s ease both; }
    .head__kicker {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 600;
    }
    .head h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.7rem, 4vw, 2.3rem);
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    .head__sub {
      margin: 0 0 16px;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.4;
      max-width: 40ch;
    }
    .progress {
      height: 6px;
      border-radius: 999px;
      background: rgba(20, 16, 12, 0.08);
      overflow: hidden;
    }
    .progress span {
      display: block; height: 100%;
      background: linear-gradient(90deg, #FD4A29, #E03E20);
      border-radius: inherit;
      transition: width 0.3s ease;
    }
    .progress__label {
      margin: 8px 0 0;
      font-family: var(--vos-mono);
      font-size: 11px;
      color: var(--vos-ink-muted);
      letter-spacing: 0.06em;
    }

    .panel {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 22px 20px 20px;
      box-shadow: 0 12px 32px rgba(20, 16, 12, 0.05);
      margin-bottom: 28px;
    }
    .panel--boot { display: grid; gap: 12px; }
    .boot-row { height: 64px; border-radius: 16px; margin: 0; }
    .boot-row--short { width: 62%; }

    .chips { display: grid; gap: 10px; }
    .chip {
      display: flex; align-items: center; gap: 12px;
      width: 100%; text-align: left;
      padding: 14px 16px; border-radius: 16px;
      border: 1px solid var(--vos-border);
      background: #faf8f4; cursor: pointer;
      font-family: inherit; color: inherit;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }
    .chip--block { align-items: flex-start; }
    .chip span, .chip strong { display: block; }
    .chip em {
      display: block; font-style: normal; margin-top: 2px;
      color: var(--vos-ink-muted); font-size: 0.9rem;
    }
    .chip strong {
      font-family: var(--vos-display);
      font-size: 1.08rem;
      letter-spacing: -0.02em;
    }
    .chip.on {
      border-color: var(--vos-brand);
      background: var(--vos-brand-soft);
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.12);
    }
    .chip__mono {
      width: 40px; height: 40px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: #fff; color: var(--vos-brand);
      font-family: var(--vos-display); font-weight: 700; font-size: 1.1rem;
      flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
    }

    .pills {
      display: flex; flex-wrap: wrap; gap: 10px;
    }
    .pill {
      border: 1px solid var(--vos-border);
      background: #fff;
      border-radius: 14px;
      padding: 12px 16px;
      min-height: 46px;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      font-family: inherit;
      color: var(--vos-ink);
      box-shadow: 0 2px 8px rgba(10, 10, 10, 0.03);
      transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .pill:hover {
      border-color: rgba(253, 74, 41, 0.35);
      transform: translateY(-1px);
    }
    .pill.on {
      background: #0a0a0a;
      color: #fff;
      border-color: #0a0a0a;
      box-shadow: 0 8px 18px rgba(10, 10, 10, 0.18);
    }

    .fields { display: grid; gap: 16px; }
    .field {
      display: block;
    }
    .field__label {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-family: var(--vos-mono);
    }
    .field__label em {
      font-style: normal;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 600;
      color: #9a968e;
      font-family: var(--vos-font);
      font-size: 0.85rem;
    }
    .field input, .field textarea {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--vos-border);
      background: #faf8f4;
      font-size: 1.02rem;
      font-family: inherit;
      color: var(--vos-ink);
      box-sizing: border-box;
      min-height: 52px;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .field textarea { min-height: 88px; resize: vertical; line-height: 1.45; }
    .field input:focus, .field textarea:focus {
      outline: none;
      background: #fff;
      border-color: rgba(253, 74, 41, 0.45);
      box-shadow: 0 0 0 4px rgba(253, 74, 41, 0.12);
    }

    .upload {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 132px;
      padding: 18px;
      border-radius: 16px;
      border: 1.5px dashed rgba(217, 212, 200, 0.95);
      background: linear-gradient(180deg, #fffef9 0%, #faf8f4 100%);
      cursor: pointer;
      text-align: center;
      overflow: hidden;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .upload:hover { border-color: rgba(253, 74, 41, 0.45); }
    .upload input {
      position: absolute; inset: 0;
      opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
      min-height: 0; padding: 0; border: 0;
    }
    .upload__icon {
      width: 36px; height: 36px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--vos-brand-soft); color: var(--vos-brand);
      font-size: 1.2rem; font-weight: 700; margin-bottom: 4px;
    }
    .upload strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      color: var(--vos-ink);
    }
    .upload em {
      font-style: normal;
      font-size: 0.88rem;
      color: var(--vos-ink-muted);
    }
    .upload--has {
      padding: 0;
      border-style: solid;
      border-color: var(--vos-border);
      min-height: 160px;
    }
    .upload__preview {
      width: 100%; height: 160px; object-fit: cover; display: block;
    }
    .upload__change {
      position: absolute; left: 12px; bottom: 12px;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(10, 10, 10, 0.72); color: #fff;
      font-size: 0.8rem; font-weight: 700;
      pointer-events: none;
    }

    .hint {
      margin: 0 0 10px;
      font-size: 0.92rem;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    .empty-state { text-align: center; padding: 12px 8px 4px; }
    .empty-state__title {
      margin: 0 0 6px;
      font-family: var(--vos-display);
      font-size: 1.2rem;
      letter-spacing: -0.02em;
    }
    .empty { color: var(--vos-ink-muted); margin: 0 0 16px; }
    .empty-state .btn { width: auto; display: inline-flex; }
    .err-link {
      margin-left: 10px;
      background: none;
      border: 0;
      padding: 0;
      color: #FD4A29;
      font-weight: 700;
      cursor: pointer;
      text-decoration: underline;
      font: inherit;
    }

    .review { display: grid; gap: 12px; }
    .review > div {
      display: grid; gap: 4px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vos-border);
    }
    .review > div:last-child { border-bottom: 0; padding-bottom: 0; }
    .review em {
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
    }
    .review strong {
      font-family: var(--vos-display);
      font-size: 1.08rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      white-space: pre-wrap;
      line-height: 1.35;
    }
    .review__pay {
      background: var(--vos-brand-soft);
      border: 1px solid rgba(253, 74, 41, 0.18) !important;
      border-radius: 14px;
      padding: 14px 14px !important;
      margin-top: 4px;
    }
    .review__pay strong { color: var(--vos-brand); }
    .review__pay span {
      font-size: 0.92rem;
      color: var(--vos-ink-muted);
      line-height: 1.4;
      font-weight: 500;
    }

    .nav {
      display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
      margin-top: 20px;
    }
    .btn, .ghost {
      min-height: 48px;
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      font-family: inherit;
      border: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn {
      background: linear-gradient(135deg, #FD4A29, #E03E20);
      color: #fff;
      box-shadow: 0 10px 24px rgba(253, 74, 41, 0.3);
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .ghost {
      background: #fff;
      color: var(--vos-ink);
      border: 1px solid var(--vos-border);
      box-shadow: 0 2px 8px rgba(10, 10, 10, 0.03);
    }
    .ghost:hover { border-color: rgba(253, 74, 41, 0.3); }
    .spin {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
      animation: spin 0.7s linear infinite;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class BookWizardComponent implements OnInit {
  reasons = REASONS;
  timeSlots = TIME_SLOTS;
  readonly step = signal(1);
  readonly pets = signal<any[]>([]);
  readonly addresses = signal<any[]>([]);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly photoPreview = signal('');
  readonly booting = signal(true);
  readonly sessionExpired = signal(false);
  petId = '';
  reason = '';
  intakeAnswers: string[] = [];
  intakeExtra = '';
  address = '';
  preferredDate = '';
  preferredTime = '10:00 AM';
  consultationType = 'Home Visit';
  photoFile: File | null = null;
  minDate = '';
  private idempotencyKey = '';

  constructor(
    private api: CustomerApiService,
    private router: Router,
    private route: ActivatedRoute,
    private activePet: ActivePetService,
    private auth: AuthService,
  ) {}

  meta() {
    return STEP_TITLES[this.step()] || STEP_TITLES[1];
  }

  ngOnInit() {
    const today = new Date();
    this.minDate = today.toISOString().slice(0, 10);
    this.preferredDate = this.minDate;
    void this.reload();
  }

  async reload() {
    this.booting.set(true);
    this.error.set('');
    this.sessionExpired.set(false);
    try {
      await this.auth.waitUntilReady();
      if (!this.auth.isLoggedIn()) {
        this.sessionExpired.set(true);
        this.error.set('Sign in to book a home visit.');
        return;
      }

      // Force a fresh token before the pets call so we don’t flash “no pets” on expiry.
      await this.auth.getIdTokenFresh(true);

      const [pets, me, addrs] = await Promise.all([
        this.api.pets(),
        this.api.me(),
        this.api.addresses().catch(() => []),
      ]);
      this.pets.set(pets || []);
      this.addresses.set(addrs || []);
      const def = (addrs || []).find((a: any) => a.isDefault);
      this.address = def?.address || me.address || '';
      const q = this.route.snapshot.queryParamMap.get('petId') || this.activePet.get();
      if (q && (pets || []).some((p: any) => p.id === q)) this.petId = q;
      else if ((pets || []).length === 1) this.petId = pets[0].id;

      if (this.petId) {
        this.activePet.set(this.petId);
        this.step.set(2);
      }
    } catch (e: any) {
      const status = e?.status as number | undefined;
      if (status === 401) {
        this.sessionExpired.set(true);
        this.pets.set([]);
        this.error.set('Your session expired. Sign in again to book for your pet.');
      } else {
        this.error.set(
          e?.error?.message || 'Couldn’t load your pets. Please try again.',
        );
      }
    } finally {
      this.booting.set(false);
    }
  }

  pickPet(id: string) {
    this.petId = id;
    this.activePet.set(id);
  }

  pretty(r: string) {
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  }

  intakeQs() {
    return INTAKE[this.reason] || INTAKE['other'];
  }

  onReason(r: string) {
    this.reason = r;
    this.intakeAnswers = this.intakeQs().map(() => '');
  }

  onPhoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0] || null;
    this.photoFile = file;
    if (this.photoPreview()) URL.revokeObjectURL(this.photoPreview());
    this.photoPreview.set(file ? URL.createObjectURL(file) : '');
  }

  pickAddress(a: any) {
    this.address = a.address || '';
  }

  go(n: number) {
    if (this.petId) this.activePet.set(this.petId);
    this.step.set(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  petName() {
    return this.pets().find((p) => p.id === this.petId)?.name || '—';
  }

  intakeText() {
    const parts = this.intakeQs()
      .map((q, i) => {
        const a = (this.intakeAnswers[i] || '').trim();
        return a ? `${q.label}: ${a}` : '';
      })
      .filter(Boolean);
    if (this.intakeExtra.trim()) parts.push(this.intakeExtra.trim());
    return parts.join('\n') || this.reason;
  }

  async confirm() {
    this.submitting.set(true);
    this.error.set('');
    if (!this.idempotencyKey) {
      this.idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    try {
      const booking = await this.api.createBooking(
        {
          petId: this.petId,
          reasonForVisit: this.reason,
          intakeText: this.intakeText(),
          address: this.address,
          preferredDate: this.preferredDate,
          preferredTime: this.preferredTime,
          consultationType: this.consultationType,
          mediaUrls: [],
        },
        this.idempotencyKey,
      );
      if (this.photoFile && booking?.id) {
        try {
          await this.api.uploadBookingFiles(booking.id, [this.photoFile]);
        } catch {
          /* booking still created */
        }
      }
      const intakeId = this.route.snapshot.queryParamMap.get('intakeId');
      if (intakeId && booking?.id) {
        try {
          await this.api.linkIntakeToBooking(intakeId, booking.id);
        } catch {
          /* non-blocking */
        }
      }
      await this.router.navigate(['/bookings', booking.id], {
        queryParams: { booked: '1' },
      });
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Booking failed');
      if (e?.error?.errors) this.error.set((e.error.errors || []).join(', '));
    } finally {
      this.submitting.set(false);
    }
  }
}
