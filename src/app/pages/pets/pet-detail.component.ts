import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pet-detail',
  template: `
    <a routerLink="/pets" class="back">← Pets</a>

    @if (loading()) {
      <div class="vos-skel hero-skel"></div>
    } @else if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    } @else if (pet(); as p) {
      <header class="hero">
        <div class="hero__glow" aria-hidden="true"></div>
        <div class="portrait">
          @if (p.photoUrl) {
            <img [src]="p.photoUrl" [alt]="p.name || 'Pet'" />
          } @else {
            <span>{{ (p.name || '?').charAt(0) }}</span>
          }
        </div>
        <h1>{{ p.name || 'Your pet' }}</h1>
        <p class="hero__meta">{{ line(p) }}</p>
        <div class="hero__cta">
          <a class="btn" routerLink="/book/new" [queryParams]="{ petId: p.id }">Book a visit</a>
          <a class="btn btn--ghost" [routerLink]="['/pets', p.id, 'health']">Health hub</a>
        </div>
      </header>

      <section class="manage" aria-label="Care shortcuts">
        <h2>Take care of {{ p.name || 'them' }}</h2>
        <div class="grid">
          <a class="act act--dark" [routerLink]="['/pets', p.id, 'passport']">
            <strong>Pet Passport</strong>
            <span>Official VetOnSpot digital ID</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'health']">
            <strong>Health hub</strong>
            <span>Meds, vaccines, conditions</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'timeline']">
            <strong>Timeline</strong>
            <span>Every visit in one story</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'documents']">
            <strong>Documents</strong>
            <span>Labs, scripts, uploads</span>
          </a>
          <a class="act" [routerLink]="['/pets', p.id, 'reminders']">
            <strong>Reminders</strong>
            <span>What comes next</span>
          </a>
          <a class="act" routerLink="/emergency" [queryParams]="{ petId: p.id }">
            <strong>Emergency</strong>
            <span>Fast path when it matters</span>
          </a>
        </div>
      </section>

      <section class="facts">
        <div class="facts__head">
          <h2>Profile</h2>
          <a [routerLink]="['/pets', p.id, 'edit']">Edit</a>
        </div>
        <div class="facts__grid">
          <div><em>Age / DOB</em><strong>{{ p.ageOrDob || '—' }}</strong></div>
          <div><em>Color</em><strong>{{ p.colorMarks || p.color || '—' }}</strong></div>
          <div><em>Weight</em><strong>{{ p.weight || '—' }}</strong></div>
          <div><em>Microchip</em><strong>{{ p.microchip || '—' }}</strong></div>
          <div class="wide"><em>Allergies</em><strong>{{ p.allergies || '—' }}</strong></div>
          <div class="wide"><em>Medical notes</em><strong>{{ p.medicalNotes || '—' }}</strong></div>
          <div class="wide"><em>Special needs</em><strong>{{ p.specialNeeds || '—' }}</strong></div>
        </div>
      </section>
    }
  `,
  styles: [`
    .back {
      display: inline-block; margin-bottom: 12px;
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .linkish {
      border: 0; background: none; font-weight: 700; cursor: pointer; text-decoration: underline;
    }
    .hero-skel { height: 220px; margin-bottom: 16px; }

    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      text-align: center;
      border-radius: 28px;
      padding: 32px 24px 28px;
      margin-bottom: 20px;
      color: #fff;
      background: linear-gradient(145deg, #FD4A29 0%, #E03E20 42%, #1a100e 100%);
      box-shadow: 0 20px 48px rgba(253, 74, 41, 0.28);
    }
    .hero__glow {
      position: absolute; width: 180px; height: 180px; border-radius: 50%;
      right: -50px; top: -60px; background: rgba(255,255,255,0.12); pointer-events: none;
    }
    .portrait {
      width: 104px; height: 104px; border-radius: 50%;
      margin: 0 auto 14px; overflow: hidden;
      background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--vos-display); font-size: 2.4rem; font-weight: 700;
      border: 3px solid rgba(255,255,255,0.35);
    }
    .portrait img { width: 100%; height: 100%; object-fit: cover; }
    .hero h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(2rem, 5vw, 2.7rem);
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .hero__meta {
      margin: 0 auto 18px;
      opacity: 0.92;
      font-size: 1.05rem;
      max-width: 36ch;
    }
    .hero__cta {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
    }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 46px; padding: 10px 20px; border-radius: 999px;
      background: #0a0a0a; color: #fff; font-weight: 700; text-decoration: none;
    }
    .btn--ghost {
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.35);
    }

    .manage { margin-bottom: 20px; }
    .manage h2, .facts h2 {
      margin: 0 0 12px;
      font-family: var(--vos-display);
      font-size: 1.35rem;
      letter-spacing: -0.03em;
    }
    .grid {
      display: grid; gap: 10px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 700px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    .act {
      display: flex; flex-direction: column; gap: 4px;
      text-decoration: none; color: inherit;
      padding: 16px 18px;
      border-radius: 18px;
      background: #fff;
      border: 1px solid var(--vos-border);
      box-shadow: 0 6px 18px rgba(20, 16, 12, 0.04);
    }
    .act--dark {
      background: #0a0a0a; color: #fff; border-color: transparent;
    }
    .act--dark span { color: rgba(255,255,255,0.7); }
    .act strong {
      font-family: var(--vos-display);
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }
    .act span { color: var(--vos-ink-muted); font-size: 0.92rem; }

    .facts {
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 22px;
      padding: 18px 18px 8px;
      margin-bottom: 28px;
      box-shadow: 0 8px 22px rgba(20, 16, 12, 0.04);
    }
    .facts__head {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-bottom: 8px;
    }
    .facts__head a {
      font-weight: 700; color: var(--vos-brand); text-decoration: none;
    }
    .facts__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 14px;
      padding-bottom: 10px;
    }
    .facts__grid .wide { grid-column: 1 / -1; }
    .facts__grid em {
      display: block;
      font-style: normal;
      font-family: var(--vos-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--vos-ink-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .facts__grid strong {
      font-family: var(--vos-display);
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
      white-space: pre-wrap;
    }
  `],
})
export class PetDetailComponent implements OnInit {
  readonly pet = signal<any>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private id = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  line(p: any): string {
    return [p.species, p.breed, p.gender || p.sex].filter(Boolean).join(' · ') || 'Pet profile';
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await this.api.pet(this.id);
      this.pet.set(p);
      if (p?.id) this.activePet.set(p.id);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
