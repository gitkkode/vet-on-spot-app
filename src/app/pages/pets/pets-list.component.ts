import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pets-list',
  template: `
    <header class="head vos-page-head">
      <div>
        <p class="kicker vos-eyebrow">Your household</p>
        <h1>My pets</h1>
        <p class="sub">Tap a pet to open their care home — health, visits, and passport.</p>
      </div>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }

    @if (loading()) {
      <div class="grid">
        <div class="vos-skel vos-skel--gloss card-skel"></div>
        <div class="vos-skel vos-skel--gloss card-skel"></div>
      </div>
    } @else if (!pets().length) {
      <div class="empty">
        <h2>Meet your first pet here</h2>
        <p>Add a profile so visits, meds, and reminders stay attached to the right face.</p>
        <a class="cta vos-btn" routerLink="/pets/new">Add your first pet</a>
      </div>
    } @else {
      <div class="grid">
        @for (p of pets(); track p.id) {
          <article class="card" [class.card--active]="activePet.get() === p.id">
            <a class="card__main" [routerLink]="['/pets', p.id]" (click)="activate(p.id)">
              <div class="portrait" aria-hidden="true">
                @if (showPhoto(p)) {
                  <img
                    [src]="p.photoUrl"
                    alt=""
                    (error)="onPhotoError(p.id)"
                  />
                } @else {
                  <span class="portrait__initial">{{ petInitial(p.name) }}</span>
                }
              </div>
              <h2>{{ displayName(p.name) }}</h2>
              <p class="meta">{{ line(p) }}</p>
              @if (activePet.get() === p.id) {
                <span class="on-home">Active on Home</span>
              }
            </a>
            <div class="card__acts">
              <a routerLink="/book/new" [queryParams]="{ petId: p.id }" (click)="activate(p.id)">Book</a>
              <a [routerLink]="['/pets', p.id, 'health']" (click)="activate(p.id)">Health</a>
            </div>
          </article>
        }

        <a class="card card--add" routerLink="/pets/new">
          <div class="card__main card__main--add">
            <div class="portrait portrait--add" aria-hidden="true">
              <span class="plus">+</span>
            </div>
            <h2>Add another pet</h2>
            <p class="meta">Build a living profile for every family member</p>
          </div>
          <div class="card__acts card__acts--ghost" aria-hidden="true">
            <span></span>
            <span></span>
          </div>
        </a>
      </div>
    }
  `,
  styles: [`
    .head { margin-bottom: 22px; }
    .kicker {
      margin: 0 0 6px;
      font-family: var(--vos-mono);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--vos-brand);
      font-weight: 600;
    }
    h1 {
      margin: 0 0 8px;
      font-family: var(--vos-display);
      font-size: clamp(1.9rem, 4.5vw, 2.6rem);
      letter-spacing: -0.04em;
      line-height: 1.05;
    }
    .sub {
      margin: 0;
      max-width: 40ch;
      color: var(--vos-ink-muted);
      font-size: 1.05rem;
      line-height: 1.4;
    }
    .linkish {
      border: 0; background: none; font-weight: 700; cursor: pointer; text-decoration: underline;
    }

    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: 1fr;
      margin-bottom: 28px;
    }
    @media (min-width: 640px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    @media (min-width: 960px) {
      .grid { grid-template-columns: 1fr 1fr 1fr; }
    }
    .card-skel { height: 280px; border-radius: 24px; }

    .card {
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid var(--vos-border);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(20, 16, 12, 0.05);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      min-height: 280px;
    }
    .card:hover {
      transform: translateY(-3px);
      box-shadow: 0 18px 40px rgba(20, 16, 12, 0.08);
    }
    .card--active {
      border-color: rgba(253, 74, 41, 0.35);
      box-shadow: 0 14px 36px rgba(253, 74, 41, 0.14);
    }
    .card__main {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: inherit;
      padding: 22px 20px 16px;
      text-align: center;
      flex: 1;
    }
    .card__main--add { pointer-events: none; }
    .portrait {
      position: relative;
      width: 96px; height: 96px;
      margin: 0 auto 14px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 10px 24px rgba(253, 74, 41, 0.15);
    }
    .portrait img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
      border: 0;
    }
    .portrait__initial {
      font-family: var(--vos-display);
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--vos-brand);
      line-height: 1;
      user-select: none;
    }
    .portrait--add {
      background: #0a0a0a;
      box-shadow: 0 10px 24px rgba(10, 10, 10, 0.18);
    }
    .plus {
      color: #fff;
      font-size: 2rem;
      font-weight: 500;
      line-height: 1;
      margin-top: -2px;
    }
    .card__main h2 {
      margin: 0 0 6px;
      font-family: var(--vos-display);
      font-size: 1.45rem;
      letter-spacing: -0.03em;
    }
    .meta {
      margin: 0;
      color: var(--vos-ink-muted);
      font-size: 0.95rem;
      line-height: 1.35;
      min-height: 1.35em;
    }
    .on-home {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--vos-brand-soft);
      color: var(--vos-brand);
      font-weight: 700;
      font-size: 0.78rem;
    }
    .card__acts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-top: 1px solid var(--vos-border);
      margin-top: auto;
      min-height: 46px;
    }
    .card__acts a {
      padding: 12px 8px;
      text-align: center;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--vos-ink);
      border-right: 1px solid var(--vos-border);
    }
    .card__acts a:last-child { border-right: 0; color: var(--vos-brand); }
    .card__acts a:hover { background: #faf8f4; }
    .card__acts--ghost {
      border-top: 1px solid transparent;
      visibility: hidden;
    }

    .card--add {
      text-decoration: none;
      color: inherit;
      border-style: dashed;
      background: linear-gradient(180deg, #fff 0%, #faf8f4 100%);
    }

    .empty {
      text-align: center;
      padding: 48px 28px;
      border-radius: 28px;
      background: linear-gradient(145deg, #FD4A29 0%, #E03E20 45%, #1a100e 100%);
      color: #fff;
      box-shadow: 0 20px 48px rgba(253, 74, 41, 0.28);
      margin-bottom: 24px;
    }
    .empty h2 {
      margin: 0 0 10px;
      font-family: var(--vos-display);
      font-size: clamp(1.6rem, 4vw, 2.1rem);
      letter-spacing: -0.03em;
    }
    .empty p {
      margin: 0 auto 22px;
      max-width: 34ch;
      opacity: 0.92;
      line-height: 1.45;
      font-size: 1.05rem;
    }
    .cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 50px;
      padding: 12px 24px;
      border-radius: 999px;
      background: #0a0a0a;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 12px 28px rgba(0,0,0,0.25);
    }
  `],
})
export class PetsListComponent implements OnInit {
  readonly pets = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly brokenPhotos = signal<Set<string>>(new Set());

  constructor(
    private api: CustomerApiService,
    public activePet: ActivePetService,
  ) {}

  ngOnInit() {
    void this.load();
  }

  showPhoto(p: { id?: string; photoUrl?: string | null }): boolean {
    const url = String(p?.photoUrl || '').trim();
    if (!url || !p?.id) return false;
    if (this.brokenPhotos().has(p.id)) return false;
    return true;
  }

  onPhotoError(id: string) {
    if (!id) return;
    this.brokenPhotos.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  petInitial(name: string | null | undefined): string {
    const n = String(name || '?').trim();
    return (n.charAt(0) || '?').toUpperCase();
  }

  displayName(name: string | null | undefined): string {
    return this.titleCase(name) || 'Pet';
  }

  private titleCase(v: string | null | undefined): string {
    const raw = String(v || '').trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  line(p: any): string {
    const species = this.prettySpecies(p.species);
    const breed = this.titleCase(p.breed);
    const gender = this.titleCase(p.gender || p.sex);
    return [species, breed, gender].filter(Boolean).join(' · ') || 'Pet profile';
  }

  /** Hide raw "Other" category; prefer breed as the natural label when needed. */
  private prettySpecies(species: string | null | undefined): string {
    const s = String(species || '').trim();
    if (!s) return '';
    if (/^other$/i.test(s)) return '';
    return this.titleCase(s);
  }

  activate(id: string) {
    this.activePet.set(id);
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const pets = (await this.api.pets()) || [];
      this.pets.set(pets);
      this.brokenPhotos.set(new Set());
      this.activePet.syncFromPets(pets);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
