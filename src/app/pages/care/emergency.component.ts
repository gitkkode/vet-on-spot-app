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

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-emergency',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <header class="head">
      <p class="eyebrow">Urgent care</p>
      <h1>Something is wrong</h1>
      <p class="vos-muted">
        Tell us what is happening so we can connect you to care. This does not auto-dispatch a veterinarian.
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

      <div class="vos-card pet-card">
        <p class="label">Which pet?</p>
        @for (p of pets(); track p.id) {
          <button type="button" class="choice" [class.on]="petId===p.id" (click)="petId=p.id">{{ p.name }}</button>
        }
        @if (!pets().length) {
          <p class="vos-empty">Add a pet first.</p>
          <a class="vos-btn vos-btn-secondary" routerLink="/pets/new">Add a pet</a>
        }
      </div>

      <div class="vos-card">
        <p class="label">What is happening?</p>
        @for (c of categories; track c) {
          <button type="button" class="choice" [class.on]="category===c" (click)="category=c">{{ c }}</button>
        }
      </div>

      <div class="vos-card">
        <label class="vos-field">Where are you?
          <input [(ngModel)]="location" name="location" placeholder="Address or landmark" />
        </label>
        <label class="vos-field">What happened?
          <textarea [(ngModel)]="whatHappened" name="whatHappened" rows="3" placeholder="Brief description"></textarea>
        </label>
        <label class="vos-field">When did this start?
          <input [(ngModel)]="whenStarted" name="whenStarted" placeholder="e.g. 20 minutes ago" />
        </label>
      </div>

      <div class="vos-card flags">
        <p class="label">Quick checks</p>
        <div class="flag">
          <span>Conscious?</span>
          <div class="tri">
            <button type="button" [class.on]="conscious===true" (click)="conscious=true">Yes</button>
            <button type="button" [class.on]="conscious===false" (click)="conscious=false">No</button>
            <button type="button" [class.on]="conscious===null" (click)="conscious=null">Unsure</button>
          </div>
        </div>
        <div class="flag">
          <span>Breathing normally?</span>
          <div class="tri">
            <button type="button" [class.on]="breathingNormally===true" (click)="breathingNormally=true">Yes</button>
            <button type="button" [class.on]="breathingNormally===false" (click)="breathingNormally=false">No</button>
            <button type="button" [class.on]="breathingNormally===null" (click)="breathingNormally=null">Unsure</button>
          </div>
        </div>
        <div class="flag">
          <span>Bleeding?</span>
          <div class="tri">
            <button type="button" [class.on]="bleeding===true" (click)="bleeding=true">Yes</button>
            <button type="button" [class.on]="bleeding===false" (click)="bleeding=false">No</button>
            <button type="button" [class.on]="bleeding===null" (click)="bleeding=null">Unsure</button>
          </div>
        </div>
        <div class="flag">
          <span>Possible poisoning?</span>
          <div class="tri">
            <button type="button" [class.on]="possiblePoisoning===true" (click)="possiblePoisoning=true">Yes</button>
            <button type="button" [class.on]="possiblePoisoning===false" (click)="possiblePoisoning=false">No</button>
            <button type="button" [class.on]="possiblePoisoning===null" (click)="possiblePoisoning=null">Unsure</button>
          </div>
        </div>
        <div class="flag">
          <span>Accident / trauma?</span>
          <div class="tri">
            <button type="button" [class.on]="accident===true" (click)="accident=true">Yes</button>
            <button type="button" [class.on]="accident===false" (click)="accident=false">No</button>
            <button type="button" [class.on]="accident===null" (click)="accident=null">Unsure</button>
          </div>
        </div>
      </div>

      <div class="vos-card">
        <label class="vos-field">Phone
          <input [(ngModel)]="phone" name="phone" type="tel" autocomplete="tel" />
        </label>
        <label class="vos-field">Notes (optional)
          <textarea [(ngModel)]="notes" name="notes" rows="2"></textarea>
        </label>
      </div>

      <div class="vos-warn disclaimer">
        <label class="ack">
          <input type="checkbox" [(ngModel)]="safetyAck" name="safetyAck" />
          <span>
            If your pet needs immediate hospital care and VetonSpot cannot reach you in time,
            seek local emergency veterinary assistance. Submitting does not guarantee instant dispatch.
          </span>
        </label>
      </div>

      <button
        class="vos-btn danger-btn"
        type="button"
        [disabled]="!canSubmit() || saving()"
        (click)="submit()"
      >
        {{ saving() ? 'Sending…' : 'Request urgent help' }}
      </button>
      <a class="vos-btn vos-btn-secondary" routerLink="/book/new" [queryParams]="{petId: petId || null}">
        Book a visit instead
      </a>
    }
  `,
  styles: [`
    .head { margin-bottom: 12px; }
    .eyebrow {
      margin: 0 0 4px; color: var(--vos-danger); letter-spacing: 0.06em;
      text-transform: uppercase; font-size: 11px; font-weight: 700;
    }
    h1 { font-family: var(--vos-display); margin: 0 0 8px; color: var(--vos-ink); }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 700;
    }
    .choice {
      display: block; width: 100%; text-align: left; margin: 6px 0; padding: 12px;
      border-radius: 12px; border: 1px solid var(--vos-border); background: #fff; cursor: pointer;
      color: var(--vos-ink);
    }
    .choice.on {
      border-color: var(--vos-danger); background: #fdecec; font-weight: 700;
    }
    .flags .flag {
      display: flex; flex-direction: column; gap: 6px; margin: 12px 0;
    }
    .flags .flag > span { font-weight: 600; font-size: 0.95rem; }
    .tri { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
    .tri button {
      min-height: 40px; border-radius: 10px; border: 1px solid var(--vos-border);
      background: #fff; cursor: pointer; color: var(--vos-ink);
    }
    .tri button.on {
      border-color: var(--vos-danger); background: #fdecec; font-weight: 700;
    }
    .disclaimer { margin-bottom: 14px; }
    .ack {
      display: flex; gap: 10px; align-items: flex-start; font-size: 0.92rem; cursor: pointer;
    }
    .ack input { margin-top: 4px; flex-shrink: 0; }
    .danger-btn { background: var(--vos-danger); margin-bottom: 10px; }
    .success .vos-btn { margin-top: 10px; }
    .vos-btn { margin-top: 8px; }
  `],
})
export class EmergencyComponent implements OnInit {
  categories = CATEGORIES;
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
      const [pets, me] = await Promise.all([this.api.pets(), this.api.me().catch(() => null)]);
      this.pets.set(pets || []);
      if (!this.petId) this.petId = this.activePet.syncFromPets(pets || []) || '';
      if (me) {
        this.phone = me.mobile || me.phone || '';
        this.location = me.address || '';
      }
    } catch {
      /* ignore */
    }
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
