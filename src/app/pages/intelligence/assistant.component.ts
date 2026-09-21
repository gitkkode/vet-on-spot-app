import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-assistant',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <header class="head">
      <p class="eyebrow">Records help</p>
      <h1>VetonSpot Assistant</h1>
      <p class="vos-muted">
        Ask about your pet's VetonSpot records — follow-ups, medications, visits.
        This is not a veterinarian and does not diagnose or prescribe.
      </p>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }

    <section class="vos-card">
      <p class="label">Which pet?</p>
      @for (p of pets(); track p.id) {
        <button type="button" class="choice" [class.on]="petId === p.id" (click)="petId = p.id">
          {{ p.name }}
        </button>
      }
      @if (!pets().length) {
        <p class="vos-empty">Add a pet to ask about records.</p>
        <a class="vos-btn vos-btn-secondary" routerLink="/pets/new">Add a pet</a>
      }

      <label class="vos-field">Your question
        <textarea
          [(ngModel)]="question"
          name="question"
          rows="3"
          placeholder="e.g. When is the next follow-up? What medications are on record?"
        ></textarea>
      </label>
      <button
        type="button"
        class="vos-btn"
        [disabled]="!petId || !question.trim() || asking()"
        (click)="ask()"
      >
        {{ asking() ? 'Looking up…' : 'Ask' }}
      </button>
    </section>

    @if (reply(); as r) {
      <section class="vos-card answer">
        <p class="label">{{ r.assistant || 'VetonSpot Assistant' }}</p>
        <p class="body">{{ r.answer }}</p>
        @if (r.note) {
          <p class="vos-muted tip">{{ r.note }}</p>
        }
        @if (r.sources?.length) {
          <p class="vos-muted tip">Grounded in {{ r.sources.length }} record source(s).</p>
        }
        @if (r.actions?.length) {
          <div class="actions">
            @for (a of r.actions; track a) {
              @if (a === 'Contact Vet' || a === 'Book Follow-up') {
                <a class="vos-btn vos-btn-secondary" routerLink="/book/new" [queryParams]="petQuery()">
                  {{ a }}
                </a>
              }
            }
          </div>
        }
      </section>
    }

    <p class="alt">
      Something feels urgent?
      <a routerLink="/intake" [queryParams]="petQuery()">Start smart intake</a>
    </p>
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
    .answer .body { margin: 0 0 8px; font-size: 1.05rem; line-height: 1.45; }
    .tip { font-size: 0.9rem; margin: 0 0 8px; }
    .actions { display: grid; gap: 8px; margin-top: 10px; }
    .alt { text-align: center; font-size: 0.9rem; color: var(--vos-ink-muted); margin-top: 16px; }
    .alt a { font-weight: 700; }
  `],
})
export class AssistantComponent implements OnInit {
  readonly pets = signal<any[]>([]);
  readonly reply = signal<any>(null);
  readonly asking = signal(false);
  readonly error = signal('');
  petId = '';
  question = '';

  constructor(
    private readonly api: CustomerApiService,
    private readonly activePet: ActivePetService,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const qPet = this.route.snapshot.queryParamMap.get('petId');
    this.petId = qPet || this.activePet.get() || '';
    if (this.petId) this.activePet.set(this.petId);
    void this.loadPets();
  }

  petQuery() {
    return this.petId ? { petId: this.petId } : {};
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

  async ask() {
    this.asking.set(true);
    this.error.set('');
    this.reply.set(null);
    try {
      this.activePet.set(this.petId);
      const data = await this.api.intelligenceAssistant({
        petId: this.petId,
        question: this.question.trim(),
      });
      this.reply.set(data);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Assistant unavailable');
    } finally {
      this.asking.set(false);
    }
  }
}
