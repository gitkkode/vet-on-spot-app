import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { petInitial, titleCase } from '../../utils/health-records';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent],
  selector: 'app-diagnostics',
  template: `
    <vos-back-button [fallback]="petFilter ? ['/pets', petFilter, 'health'] : '/health'" fallbackLabel="Health" />

    <header class="head">
      @if (activeName()) {
        <div class="who" aria-hidden="true">
          <span class="avatar">{{ petInitial(activeName()) }}</span>
        </div>
      }
      <div>
        <p class="kicker">Health record</p>
        <h1>
          @if (activeName()) {
            {{ titleCase(activeName()) }}’s Diagnostics
          } @else {
            Diagnostics
          }
        </h1>
        <p class="lede">Lab and diagnostic results. Orders are placed by your veterinarian.</p>
      </div>
    </header>

    <div class="switcher" role="tablist" aria-label="Switch pet">
      <button type="button" class="chip" [class.on]="!petFilter" (click)="pick(null)">All pets</button>
      @for (p of pets(); track p.id) {
        <button type="button" class="chip" [class.on]="petFilter === p.id" (click)="pick(p.id)">
          {{ titleCase(p.name) }}
        </button>
      }
    </div>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }

    @if (loading()) {
      <div class="vos-skel"></div>
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <div class="empty">
        <div class="empty__mark" aria-hidden="true"></div>
        <h2>No diagnostic orders yet</h2>
        <p>
          @if (activeName()) {
            Lab work for {{ titleCase(activeName()) }} will show here after your vet places an order.
          } @else {
            Lab work appears here after your vet places an order during a visit.
          }
        </p>
        <div class="empty__actions">
          @if (petFilter) {
            <a class="vos-btn" [routerLink]="['/pets', petFilter, 'timeline']">View timeline</a>
            <a class="vos-btn vos-btn-secondary" [routerLink]="['/pets', petFilter, 'documents']">Upload past records</a>
          } @else {
            <a class="vos-btn" routerLink="/health">Back to Health</a>
            <a class="vos-btn vos-btn-secondary" routerLink="/documents">Upload past records</a>
          }
        </div>
      </div>
    } @else {
      @for (d of items(); track d.id) {
        <a class="vos-card item" [routerLink]="['/diagnostics', d.id]">
          <div class="row">
            <strong>{{ d.testName }}</strong>
            <span class="vos-badge">{{ statusLabel(d.status) }}</span>
          </div>
          <p class="vos-muted">{{ titleCase(d.petName) }} · {{ (d.createdAt || '').slice(0, 10) }}</p>
          @if (d.customerMessage) {
            <p class="msg">{{ d.customerMessage }}</p>
          }
        </a>
      }
    }

    @if (catalog().length) {
      <h2 class="cat-title">Catalog</h2>
      <p class="vos-muted small">Common tests your care team may order. Prices shown only when configured.</p>
      @for (c of catalog(); track c.code) {
        <div class="vos-card cat">
          <strong>{{ c.name }}</strong>
          @if (c.description) { <p class="vos-muted">{{ c.description }}</p> }
          <p class="vos-muted">
            {{ c.sampleType || 'Sample varies' }}
            @if (c.turnaroundHours) { · ~{{ c.turnaroundHours }}h }
            @if (c.priceCents != null) { · ₹{{ (c.priceCents / 100).toFixed(0) }} }
          </p>
        </div>
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
    h1 { margin: 0; font-family: var(--vos-display); font-size: clamp(1.55rem, 3.5vw, 2rem); letter-spacing: -0.03em; }
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); }
    .cat-title { font-family: var(--vos-display); font-size: 1.1rem; margin: 20px 0 6px; }
    .small { font-size: 0.9rem; margin-top: 0; }
    .switcher { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; }
    .chip {
      border: 1px solid var(--vos-border); background: #fff; border-radius: 999px;
      padding: 8px 14px; font-weight: 600; cursor: pointer; color: var(--vos-ink);
    }
    .chip.on { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .item { display: block; text-decoration: none; color: inherit; cursor: pointer; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .msg { margin: 6px 0 0; font-size: 0.92rem; color: var(--vos-brand); font-weight: 600; }
    .cat p { margin: 4px 0 0; }
    .empty {
      text-align: center; padding: 36px 22px;
      border-radius: 24px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 14px;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
      position: relative;
    }
    .empty__mark::after {
      content: ''; position: absolute; inset: 14px 18px;
      border: 2px solid var(--vos-brand); border-radius: 4px;
    }
    .empty h2 { margin: 0 0 8px; font-family: var(--vos-display); }
    .empty p { margin: 0 auto 18px; max-width: 38ch; color: var(--vos-ink-muted); }
    .empty__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class DiagnosticsComponent implements OnInit, OnDestroy {
  petFilter: string | null = null;
  readonly pets = signal<any[]>([]);
  readonly items = signal<any[]>([]);
  readonly catalog = signal<any[]>([]);
  readonly activeName = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  private sub?: Subscription;

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  titleCase = titleCase;
  petInitial = petInitial;

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      this.petFilter = id || this.activePet.get();
      if (this.petFilter) this.activePet.set(this.petFilter);
      void this.bootstrap();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  statusLabel(s: string) {
    return String(s || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async bootstrap() {
    try {
      const pets = await this.api.pets();
      this.pets.set(pets || []);
      this.syncName();
    } catch {
      /* ignore */
    }
    await this.load();
    try {
      this.catalog.set((await this.api.diagnosticsCatalog()) || []);
    } catch {
      this.catalog.set([]);
    }
  }

  private syncName() {
    if (!this.petFilter) {
      this.activeName.set('');
      return;
    }
    const p = this.pets().find((x) => x.id === this.petFilter);
    this.activeName.set(p?.name || '');
  }

  pick(id: string | null) {
    this.petFilter = id;
    if (id) {
      this.activePet.set(id);
      const onPetRoute = this.route.snapshot.paramMap.has('id');
      if (onPetRoute) {
        void this.router.navigate(['/pets', id, 'diagnostics']);
        return;
      }
    }
    this.syncName();
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    this.syncName();
    try {
      this.items.set((await this.api.diagnostics(this.petFilter)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not load diagnostics');
    } finally {
      this.loading.set(false);
    }
  }
}
