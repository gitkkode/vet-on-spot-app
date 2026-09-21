import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

type Step = 'start' | 'draft' | 'questions' | 'summary' | 'recommend';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-smart-intake',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <header class="head">
      <p class="eyebrow">Smart intake</p>
      <h1>Something is wrong</h1>
      <p class="vos-muted">
        Describe what you are seeing. We will help you organize details for a veterinarian —
        this is <strong>not a diagnosis</strong>.
      </p>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }

    @if (step() === 'start') {
      <section class="vos-card">
        <p class="label">Which pet?</p>
        @for (p of pets(); track p.id) {
          <button type="button" class="choice" [class.on]="petId === p.id" (click)="petId = p.id">
            {{ p.name }}
          </button>
        }
        @if (!pets().length) {
          <p class="vos-empty">Add a pet first.</p>
          <a class="vos-btn vos-btn-secondary" routerLink="/pets/new">Add a pet</a>
        }
      </section>
      <section class="vos-card">
        <label class="vos-field">What is happening?
          <textarea
            [(ngModel)]="freeText"
            name="freeText"
            rows="4"
            placeholder="e.g. Vomiting since this morning, low appetite…"
          ></textarea>
        </label>
        <button
          type="button"
          class="vos-btn"
          [disabled]="!petId || !freeText.trim() || saving()"
          (click)="start()"
        >
          {{ saving() ? 'Working…' : 'Continue' }}
        </button>
      </section>
      <p class="alt">
        Prefer urgent care form?
        <a routerLink="/emergency" [queryParams]="petQuery()">Go to emergency request</a>
      </p>
    }

    @if (step() === 'draft' && session(); as s) {
      <section class="vos-card">
        <div class="row-head">
          <p class="label">{{ s.extractionLabel || s.extraction?.label || 'AI_EXTRACTED_DRAFT' }}</p>
          <span class="vos-badge">Editable</span>
        </div>
        <p class="vos-muted tip">
          Draft only — review and edit before sharing with a veterinarian. Not a diagnosis.
        </p>
        <label class="vos-field">Primary concern
          <input [(ngModel)]="draft.primaryConcern" name="primaryConcern" />
        </label>
        <label class="vos-field">Symptoms (comma-separated)
          <input [(ngModel)]="draft.symptomsText" name="symptoms" />
        </label>
        <label class="vos-field">Duration
          <input [(ngModel)]="draft.duration" name="duration" />
        </label>
        <label class="vos-field">Frequency
          <input [(ngModel)]="draft.frequency" name="frequency" />
        </label>
        <label class="vos-field">Observations
          <textarea [(ngModel)]="draft.observationsText" name="observations" rows="2"></textarea>
        </label>
        <label class="check">
          <input type="checkbox" [(ngModel)]="draft.emergencyFlag" name="emergencyFlag" />
          This may need urgent attention
        </label>
        <button type="button" class="vos-btn" [disabled]="saving()" (click)="saveDraft()">
          {{ saving() ? 'Saving…' : 'Save & continue' }}
        </button>
      </section>
    }

    @if (step() === 'questions') {
      <section class="vos-card">
        <p class="label">A few more details</p>
        <p class="vos-muted tip">{{ banner() }}</p>
        @if (!pendingQuestions().length) {
          <p class="vos-empty">No additional questions right now.</p>
          <button type="button" class="vos-btn" (click)="goSummary()">Continue</button>
        } @else {
          @for (q of pendingQuestions(); track q.questionKey) {
            <div class="q">
              <p class="q-prompt">{{ q.prompt }}</p>
              @if (q.type === 'choice' && q.options?.length) {
                <div class="opts">
                  @for (opt of q.options; track optValue(opt)) {
                    <button
                      type="button"
                      class="choice"
                      [class.on]="answerDraft[q.questionKey] === optValue(opt)"
                      (click)="answerDraft[q.questionKey] = optValue(opt)"
                    >
                      {{ optLabel(opt) }}
                    </button>
                  }
                </div>
              } @else {
                <label class="vos-field">
                  <input
                    [(ngModel)]="answerDraft[q.questionKey]"
                    [name]="'a_' + q.questionKey"
                    [placeholder]="'Your answer'"
                  />
                </label>
              }
            </div>
          }
          <button
            type="button"
            class="vos-btn"
            [disabled]="saving() || !allQuestionsAnswered()"
            (click)="submitAnswers()"
          >
            {{ saving() ? 'Saving…' : 'Continue' }}
          </button>
        }
      </section>
    }

    @if (step() === 'summary' && session(); as s) {
      <section class="vos-card">
        <p class="label">What you told us</p>
        <p class="vos-muted tip">Review before we suggest next steps. This is not a diagnosis.</p>
        <dl class="sum">
          <dt>Pet</dt>
          <dd>{{ s.petName || '—' }}</dd>
          <dt>You described</dt>
          <dd>{{ s.freeText || '—' }}</dd>
          <dt>Concern</dt>
          <dd>{{ s.extraction?.primaryConcern || '—' }}</dd>
          <dt>Symptoms</dt>
          <dd>{{ (s.extraction?.symptoms || []).join(', ') || '—' }}</dd>
          <dt>Duration</dt>
          <dd>{{ s.extraction?.duration || '—' }}</dd>
          <dt>Frequency</dt>
          <dd>{{ s.extraction?.frequency || '—' }}</dd>
          @if (answerEntries(s).length) {
            <dt>Your answers</dt>
            <dd>
              <ul>
                @for (a of answerEntries(s); track a.key) {
                  <li><strong>{{ a.key }}:</strong> {{ a.value }}</li>
                }
              </ul>
            </dd>
          }
        </dl>
        <div class="actions">
          <button type="button" class="vos-btn vos-btn-secondary" (click)="editDraft()">Edit</button>
          <button type="button" class="vos-btn" [disabled]="saving()" (click)="complete()">
            {{ saving() ? 'Finishing…' : 'Continue' }}
          </button>
        </div>
      </section>
    }

    @if (step() === 'recommend') {
      @if (isEmergency()) {
        <div class="vos-err emergency">
          <strong>Urgent care may be needed</strong>
          <p>
            Based on what you shared, seek veterinary care promptly. If your pet is in immediate
            danger, contact a local emergency clinic or veterinary hospital now. VetonSpot does not
            auto-dispatch a veterinarian from this screen.
          </p>
        </div>
      }
      <section class="vos-card">
        <p class="label">Suggested next step</p>
        <h2 class="rec-title">{{ recommendation()?.title || 'Veterinary consultation' }}</h2>
        <p>{{ recommendation()?.reason || 'A veterinarian consultation may be appropriate.' }}</p>
        <p class="vos-muted tip">Guidance only — not a diagnosis or treatment plan.</p>
        <div class="actions">
          @if (isEmergency()) {
            <a class="vos-btn vos-btn-accent" routerLink="/emergency" [queryParams]="petQuery()">
              Request emergency care
            </a>
          }
          @if (recService() === 'tele_vet') {
            <a class="vos-btn" routerLink="/televet" [queryParams]="petQuery()">Talk to a Vet</a>
            <a class="vos-btn vos-btn-secondary" routerLink="/book/new" [queryParams]="bookQuery()">
              Book home visit
            </a>
          } @else if (!isEmergency()) {
            <a class="vos-btn" routerLink="/book/new" [queryParams]="bookQuery()">Book a vet</a>
            <a class="vos-btn vos-btn-secondary" routerLink="/televet" [queryParams]="petQuery()">
              Talk to a Vet
            </a>
          }
          <a class="vos-btn vos-btn-ghost" routerLink="/assistant" [queryParams]="petQuery()">
            Ask VetonSpot Assistant
          </a>
        </div>
      </section>

      @if (match(); as m) {
        <section class="vos-card">
          <p class="label">Doctor match (optional)</p>
          <p class="vos-muted tip">{{ m.note || 'Ranking for your booking — assignment is confirmed by care team.' }}</p>
          @if (m.recommended; as d) {
            <p><strong>{{ d.name }}</strong></p>
            <p class="vos-muted">{{ (d.reasons || []).join(' · ') }}</p>
          } @else {
            <p class="vos-empty">No match yet — book first, then we can suggest eligible doctors.</p>
          }
        </section>
      }
    }
  `,
  styles: [`
    .head { margin-bottom: 12px; }
    .eyebrow {
      margin: 0 0 4px; color: var(--vos-brand); letter-spacing: 0.06em;
      text-transform: uppercase; font-size: 11px; font-weight: 700;
    }
    h1 { font-family: var(--vos-display); margin: 0 0 8px; }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .choice {
      display: block; width: 100%; text-align: left; margin: 0 0 8px;
      padding: 12px 14px; border-radius: var(--vos-radius-sm);
      border: 1px solid var(--vos-border); background: var(--vos-surface);
      color: var(--vos-ink); cursor: pointer; font-weight: 600;
    }
    .choice.on { border-color: var(--vos-brand); background: var(--vos-brand-soft); }
    .tip { font-size: 0.9rem; margin: 0 0 12px; }
    .row-head { display: flex; justify-content: space-between; align-items: center; }
    .check {
      display: flex; align-items: center; gap: 8px; margin: 12px 0 16px;
      font-weight: 600; font-size: 0.95rem;
    }
    .q { margin-bottom: 14px; padding-top: 8px; border-top: 1px solid var(--vos-border); }
    .q:first-of-type { border-top: 0; padding-top: 0; }
    .q-prompt { margin: 0 0 8px; font-weight: 600; }
    .opts { display: grid; gap: 6px; }
    .sum { margin: 0; display: grid; grid-template-columns: 110px 1fr; gap: 8px 12px; }
    .sum dt { color: var(--vos-ink-muted); font-size: 0.85rem; }
    .sum dd { margin: 0; }
    .sum ul { margin: 0; padding-left: 18px; }
    .actions { display: grid; gap: 10px; margin-top: 14px; }
    .rec-title { font-family: var(--vos-display); margin: 0 0 8px; font-size: 1.25rem; }
    .emergency p { margin: 8px 0 0; }
    .alt { text-align: center; font-size: 0.9rem; color: var(--vos-ink-muted); }
    .alt a { font-weight: 700; }
  `],
})
export class SmartIntakeComponent implements OnInit {
  readonly pets = signal<any[]>([]);
  readonly step = signal<Step>('start');
  readonly session = signal<any>(null);
  readonly questions = signal<any[]>([]);
  readonly recommendation = signal<any>(null);
  readonly match = signal<any>(null);
  readonly banner = signal(
    'Thanks. A few questions will help the veterinarian understand what is happening. This is not a diagnosis.',
  );
  readonly saving = signal(false);
  readonly error = signal('');

  petId = '';
  freeText = '';
  draft = {
    primaryConcern: '',
    symptomsText: '',
    duration: '',
    frequency: '',
    observationsText: '',
    emergencyFlag: false,
  };
  answerDraft: Record<string, unknown> = {};

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    const qPet = this.route.snapshot.queryParamMap.get('petId');
    if (qPet) {
      this.petId = qPet;
      this.activePet.set(qPet);
    } else {
      this.petId = this.activePet.get() || '';
    }
    void this.loadPets();
    const resume = this.route.snapshot.queryParamMap.get('intakeId');
    if (resume) void this.resume(resume);
  }

  petQuery() {
    return this.petId ? { petId: this.petId } : {};
  }

  bookQuery() {
    const q: Record<string, string> = {};
    if (this.petId) q['petId'] = this.petId;
    const sid = this.session()?.id;
    if (sid) q['intakeId'] = sid;
    return q;
  }

  pendingQuestions() {
    const answered = this.session()?.answers || {};
    return (this.questions() || []).filter((q) => answered[q.questionKey] == null || answered[q.questionKey] === '');
  }

  allQuestionsAnswered() {
    return this.pendingQuestions().every((q) => {
      const v = this.answerDraft[q.questionKey];
      return v != null && String(v).trim() !== '';
    });
  }

  optValue(opt: any) {
    if (opt == null) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    return String(opt.value ?? opt.key ?? opt.id ?? opt.label ?? '');
  }

  optLabel(opt: any) {
    if (opt == null) return '';
    if (typeof opt === 'string' || typeof opt === 'number') return String(opt);
    return String(opt.label ?? opt.name ?? opt.value ?? opt.key ?? '');
  }

  answerEntries(s: any) {
    return Object.entries(s?.answers || {}).map(([key, value]) => ({ key, value }));
  }

  isEmergency() {
    const r = this.recommendation();
    return (
      this.session()?.emergencyFlag ||
      r?.service === 'emergency' ||
      r?.connectTo === 'emergency'
    );
  }

  recService() {
    return this.recommendation()?.service || '';
  }

  async loadPets() {
    try {
      const list = await this.api.pets();
      this.pets.set(Array.isArray(list) ? list : list?.pets || []);
      if (!this.petId && this.pets().length) {
        this.petId = this.activePet.get() || this.pets()[0].id;
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not load pets');
    }
  }

  private applySession(s: any) {
    this.session.set(s);
    this.petId = s.petId || this.petId;
    const ex = s.extraction || {};
    this.draft = {
      primaryConcern: ex.primaryConcern || '',
      symptomsText: (ex.symptoms || []).join(', '),
      duration: ex.duration || '',
      frequency: ex.frequency || '',
      observationsText: (ex.observations || []).join('; '),
      emergencyFlag: Boolean(ex.emergencyFlag || s.emergencyFlag),
    };
    this.recommendation.set(s.recommendedService || null);
  }

  async resume(id: string) {
    this.saving.set(true);
    this.error.set('');
    try {
      const data = await this.api.getIntake(id);
      this.applySession(data.session);
      this.questions.set(data.questions || []);
      if (data.session?.status === 'completed' || data.session?.summary?.label) {
        this.recommendation.set(data.session.recommendedService || this.recommendation());
        this.step.set('recommend');
      } else if (Object.keys(data.session?.answers || {}).length) {
        this.step.set('summary');
      } else {
        this.step.set('draft');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not resume intake');
    } finally {
      this.saving.set(false);
    }
  }

  async start() {
    this.saving.set(true);
    this.error.set('');
    try {
      this.activePet.set(this.petId);
      const data = await this.api.startIntake({
        petId: this.petId,
        freeText: this.freeText.trim(),
      });
      this.applySession(data.session);
      this.questions.set(data.questions || []);
      if (data.message) this.banner.set(data.message);
      this.step.set('draft');
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { petId: this.petId, intakeId: data.session?.id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not start intake');
    } finally {
      this.saving.set(false);
    }
  }

  async saveDraft() {
    const id = this.session()?.id;
    if (!id) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const symptoms = this.draft.symptomsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const observations = this.draft.observationsText
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await this.api.updateIntakeExtraction(id, {
        primaryConcern: this.draft.primaryConcern.trim() || null,
        symptoms,
        duration: this.draft.duration.trim() || null,
        frequency: this.draft.frequency.trim() || null,
        observations,
        emergencyFlag: this.draft.emergencyFlag,
      });
      this.applySession(updated);
      this.step.set('questions');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save draft');
    } finally {
      this.saving.set(false);
    }
  }

  editDraft() {
    this.step.set('draft');
  }

  goSummary() {
    this.step.set('summary');
  }

  async submitAnswers() {
    const id = this.session()?.id;
    if (!id) return;
    this.saving.set(true);
    this.error.set('');
    try {
      let latest = this.session();
      for (const q of this.pendingQuestions()) {
        latest = await this.api.saveIntakeAnswer(id, {
          questionKey: q.questionKey,
          value: this.answerDraft[q.questionKey],
        });
      }
      this.applySession(latest);
      this.step.set('summary');
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save answers');
    } finally {
      this.saving.set(false);
    }
  }

  async complete() {
    const id = this.session()?.id;
    if (!id) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const data = await this.api.completeIntake(id);
      this.applySession(data.session);
      this.recommendation.set(data.recommendedService || data.session?.recommendedService || null);
      this.step.set('recommend');

      // Optional: prepare booking draft (does not create a booking)
      try {
        await this.api.prepareBookingIntelligence({
          petId: this.petId,
          service: this.recommendation()?.service || 'home_vet',
          intakeSessionId: id,
        });
      } catch {
        /* non-blocking */
      }

      // Doctor match only if intake already linked to a booking
      const bookingId = data.session?.bookingId;
      if (bookingId) {
        try {
          this.match.set(await this.api.bookingMatch(bookingId));
        } catch {
          this.match.set(null);
        }
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not complete intake');
    } finally {
      this.saving.set(false);
    }
  }
}
