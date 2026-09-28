import { Component, Input, OnChanges, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { CustomerApiService } from '../services/customer-api.service';
import { ActivePetService } from '../services/active-pet.service';
import { petInitial, titleCase } from '../utils/health-records';
import { VosBackButtonComponent } from './vos-back-button.component';

export type HealthSectionId =
  | 'overview'
  | 'timeline'
  | 'medications'
  | 'vaccinations'
  | 'diagnostics'
  | 'conditions'
  | 'care-plans'
  | 'documents'
  | 'reminders'
  | 'calendar'
  | 'weight'
  | 'passport';

const TABS: { id: HealthSectionId; label: string; path: string }[] = [
  { id: 'overview', label: 'Overview', path: 'health' },
  { id: 'timeline', label: 'Timeline', path: 'timeline' },
  { id: 'medications', label: 'Medications', path: 'medications' },
  { id: 'vaccinations', label: 'Vaccinations', path: 'vaccinations' },
  { id: 'diagnostics', label: 'Diagnostics', path: 'diagnostics' },
  { id: 'conditions', label: 'Conditions', path: 'conditions' },
  { id: 'care-plans', label: 'Care plans', path: 'care-plans' },
  { id: 'documents', label: 'Documents', path: 'documents' },
  { id: 'reminders', label: 'Reminders', path: 'reminders' },
  { id: 'calendar', label: 'Calendar', path: 'calendar' },
  { id: 'weight', label: 'Weight', path: 'weight' },
  { id: 'passport', label: 'Passport', path: 'passport' },
];

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent],
  selector: 'vos-health-shell',
  template: `
    <vos-back-button
      [fallback]="section === 'overview' ? '/home' : ['/pets', resolvedId() || petId, 'health']"
      [fallbackLabel]="section === 'overview' ? 'Home' : 'Health'"
    />

    <header class="head">
      <span class="avatar" aria-hidden="true">{{ petInitial(petName()) }}</span>
      <div>
        <p class="kicker">Health record</p>
        <h1>{{ titleCase(petName()) || 'Pet' }}’s {{ sectionTitle }}</h1>
        @if (lede) {
          <p class="lede">{{ lede }}</p>
        }
      </div>
    </header>

    @if (pets().length) {
      <div class="switcher" role="tablist" aria-label="Switch pet">
        @for (p of pets(); track p.id) {
          <a
            class="chip"
            [class.on]="isCurrent(p.id)"
            [routerLink]="['/pets', p.id, tabPath()]"
            (click)="previewPet(p.id)"
          >
            {{ titleCase(p.name) }}
          </a>
        }
      </div>
    }

    @if (currentId()) {
      <nav class="tabs" aria-label="Health sections">
        @for (t of tabs; track t.id) {
          <a
            class="tab"
            [class.on]="section === t.id"
            [routerLink]="['/pets', currentId(), t.path]"
          >{{ t.label }}</a>
        }
      </nav>
    }

    <div class="body">
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .head { display: flex; gap: 14px; align-items: flex-start; margin: 8px 0 14px; }
    .avatar {
      width: 48px; height: 48px; border-radius: 50%; flex: 0 0 auto;
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      color: var(--vos-brand); font-family: var(--vos-display);
      font-size: 1.2rem; font-weight: 700;
      box-shadow: 0 0 0 3px rgba(253, 74, 41, 0.12);
    }
    .kicker {
      margin: 0 0 4px; font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--vos-brand); font-weight: 700;
    }
    h1 {
      margin: 0; font-family: var(--vos-display);
      font-size: clamp(1.55rem, 3.5vw, 2rem); letter-spacing: -0.03em;
    }
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); max-width: 52ch; }
    .switcher { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
    .chip {
      border: 1px solid var(--vos-border); background: #fff;
      border-radius: 999px; padding: 8px 14px; font-weight: 600; cursor: pointer;
      color: var(--vos-ink); font: inherit; text-decoration: none;
    }
    .chip.on { background: var(--vos-brand-soft); border-color: var(--vos-brand); color: var(--vos-brand); }
    .tabs {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin: 0 0 16px; padding: 4px;
      background: #f3efe6; border-radius: 14px;
    }
    .tab {
      display: inline-flex; align-items: center;
      min-height: 36px; padding: 6px 12px; border-radius: 10px;
      text-decoration: none; color: var(--vos-ink-muted);
      font-weight: 700; font-size: 0.88rem; white-space: nowrap;
    }
    .tab:hover { color: var(--vos-ink); background: rgba(255,255,255,0.55); }
    .tab.on {
      background: #fff; color: var(--vos-ink);
      box-shadow: 0 4px 12px rgba(10, 10, 10, 0.06);
    }
    .body { min-width: 0; }
  `],
})
export class HealthShellComponent implements OnInit, OnChanges, OnDestroy {
  @Input() petId = '';
  @Input() section: HealthSectionId = 'overview';
  @Input() sectionTitle = 'Health';
  @Input() lede = '';

  readonly pets = signal<any[]>([]);
  readonly petName = signal('');
  readonly resolvedId = signal('');
  readonly tabs = TABS;
  private sub?: Subscription;
  private loadGen = 0;

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private router: Router,
  ) {}

  titleCase = titleCase;
  petInitial = petInitial;

  ngOnInit() {
    this.applyPetId(this.routePetId() || this.petId);
    void this.loadPets();
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyPetId(this.routePetId() || this.petId));
  }

  ngOnChanges() {
    this.applyPetId(this.routePetId() || this.petId);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  currentId(): string {
    return this.resolvedId() || this.routePetId() || this.petId;
  }

  isCurrent(id: string): boolean {
    return !!id && String(id) === String(this.currentId());
  }

  tabPath(): string {
    return TABS.find((t) => t.id === this.section)?.path || 'health';
  }

  /** Show the chosen pet immediately; the link then updates the URL. */
  previewPet(id: string) {
    this.applyPetId(id);
  }

  private routePetId(): string {
    const path = this.router.url.split(/[?#]/)[0];
    const match = path.match(/^\/pets\/([^/]+)(?:\/|$)/);
    if (!match) return '';
    const id = decodeURIComponent(match[1]);
    return id === 'new' ? '' : id;
  }

  private applyPetId(id: string) {
    const next = String(id || '').trim();
    if (!next) return;
    this.resolvedId.set(next);
    const pet = this.pets().find((p) => String(p?.id) === next);
    if (pet?.name) this.petName.set(pet.name);
    this.activePet.set(next);
  }

  private async loadPets() {
    const gen = ++this.loadGen;
    try {
      const pets = (await this.api.pets()) || [];
      if (gen !== this.loadGen) return;
      this.pets.set(pets);
      const id =
        this.resolvedId() ||
        this.routePetId() ||
        this.petId ||
        this.activePet.syncFromPets(pets) ||
        '';
      if (!id) return;
      this.resolvedId.set(id);
      const pet = pets.find((p: any) => String(p.id) === String(id));
      this.petName.set(pet?.name || this.petName());
      this.activePet.set(id);
    } catch {
      if (gen === this.loadGen) this.pets.set([]);
    }
  }
}
