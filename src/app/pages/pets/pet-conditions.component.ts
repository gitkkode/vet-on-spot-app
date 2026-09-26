import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import {
  conditionsFromTimeline,
  petInitial,
  titleCase,
} from '../../utils/health-records';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent],
  selector: 'app-pet-conditions',
  template: `
    <vos-back-button [fallback]="['/pets', petId, 'health']" fallbackLabel="Health" />

    <header class="head">
      <div class="who" aria-hidden="true">
        <span class="avatar">{{ petInitial(petName()) }}</span>
      </div>
      <div>
        <p class="kicker">Health record</p>
        <h1>{{ titleCase(petName()) || 'Pet' }}’s Conditions</h1>
        <p class="lede">Problem list from your care team — not a diagnosis tool.</p>
      </div>
    </header>

    <div class="switcher" role="tablist" aria-label="Switch pet">
      @for (p of pets(); track p.id) {
        <button type="button" class="chip" [class.on]="petId === p.id" (click)="switchPet(p.id)">
          {{ titleCase(p.name) }}
        </button>
      }
    </div>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <div class="empty">
        <div class="empty__mark" aria-hidden="true"></div>
        <h2>No conditions on file</h2>
        <p>Diagnoses your vet records during visits will appear here. Past paperwork can live in Documents.</p>
        <div class="empty__actions">
          <a class="vos-btn" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
          <a class="vos-btn vos-btn-secondary" [routerLink]="['/pets', petId, 'documents']">Upload past records</a>
        </div>
      </div>
    } @else {
      @if (fromVisits()) {
        <p class="hint">Pulled from visit notes — formal problem-list entries appear when your vet files them.</p>
      }
      @for (c of items(); track c.id) {
        <article class="vos-card">
          <div class="top">
            <h2>{{ c.name }}</h2>
            <span class="badge">{{ c.status }}</span>
          </div>
          @if (c.firstDiagnosedOn) {
            <p class="vos-muted">Since {{ c.firstDiagnosedOn }}</p>
          }
          @if (c.resolvedOn) {
            <p class="vos-muted">Resolved {{ c.resolvedOn }}</p>
          }
          @if (c.customerVisibleNotes) {
            <p>{{ c.customerVisibleNotes }}</p>
          }
          @if (c.visitId) {
            <a class="link" [routerLink]="['/visits', c.visitId]">Visit summary</a>
          }
        </article>
      }
    }
  `,
  styles: [`
    .head { display: flex; gap: 14px; align-items: flex-start; margin: 8px 0 14px; }
    .avatar {
      width: 48px; height: 48px; border-radius: 50%;
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
    h1, h2 { margin: 0; font-family: var(--vos-display); }
    h1 { font-size: clamp(1.55rem, 3.5vw, 2rem); letter-spacing: -0.03em; }
    h2 { font-size: 1.1rem; }
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); }
    .switcher { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
    .chip {
      border: 1px solid var(--vos-border); background: var(--vos-surface);
      border-radius: 999px; padding: 8px 14px; font-weight: 600; cursor: pointer; color: var(--vos-ink);
    }
    .chip.on { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .hint {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 12px;
      background: #fff7e8; color: #8a5a12; font-size: 0.9rem;
    }
    .top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .badge {
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 4px 8px; border-radius: 8px; background: var(--vos-brand-soft); color: var(--vos-brand);
      text-transform: capitalize;
    }
    .empty {
      text-align: center; padding: 36px 22px;
      border-radius: 24px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 14px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin-bottom: 8px; }
    .empty p { margin: 0 auto 18px; max-width: 36ch; color: var(--vos-ink-muted); }
    .empty__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .link { display: inline-block; margin-top: 8px; font-weight: 700; text-decoration: none; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetConditionsComponent implements OnInit, OnDestroy {
  readonly items = signal<any[]>([]);
  readonly pets = signal<any[]>([]);
  readonly petName = signal('');
  readonly fromVisits = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';
  private sub?: Subscription;

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private router: Router,
    private activePet: ActivePetService,
  ) {}

  titleCase = titleCase;
  petInitial = petInitial;

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      this.petId = pm.get('id') || '';
      if (this.petId) this.activePet.set(this.petId);
      void this.load();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  switchPet(id: string) {
    if (id === this.petId) return;
    this.activePet.set(id);
    void this.router.navigate(['/pets', id, 'conditions']);
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const pets = (await this.api.pets()) || [];
      this.pets.set(pets);
      this.petId = this.activePet.syncFromPets(pets, this.petId) || this.petId;
      const pet = pets.find((p: any) => p.id === this.petId);
      this.petName.set(pet?.name || '');

      const [official, timeline] = await Promise.all([
        this.api.conditions(this.petId),
        this.api.petTimeline(this.petId).catch(() => null),
      ]);
      if (!this.petName() && timeline?.pet?.name) this.petName.set(timeline.pet.name);

      let list = official || [];
      let derived = false;
      if (!list.length) {
        list = conditionsFromTimeline(timeline);
        derived = list.length > 0;
      }
      this.items.set(list);
      this.fromVisits.set(derived);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
