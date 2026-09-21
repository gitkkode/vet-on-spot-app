import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-diagnostics',
  template: `
    <a routerLink="/health" class="vos-back">← Health</a>
    <h1>Diagnostics</h1>
    <p class="vos-muted">Lab and diagnostic results for your pets. Orders are placed by your veterinarian.</p>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }

    <div class="switcher">
      <button type="button" class="chip" [class.on]="!petFilter" (click)="pick(null)">All pets</button>
      @for (p of pets(); track p.id) {
        <button type="button" class="chip" [class.on]="petFilter===p.id" (click)="pick(p.id)">{{ p.name }}</button>
      }
    </div>

    @if (loading()) {
      <div class="vos-skel"></div>
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No diagnostic orders yet.</p>
    } @else {
      @for (d of items(); track d.id) {
        <a class="vos-card item" [routerLink]="['/diagnostics', d.id]">
          <div class="row">
            <strong>{{ d.testName }}</strong>
            <span class="vos-badge">{{ statusLabel(d.status) }}</span>
          </div>
          <p class="vos-muted">{{ d.petName }} · {{ (d.createdAt || '').slice(0, 10) }}</p>
          @if (d.customerMessage) {
            <p class="msg">{{ d.customerMessage }}</p>
          }
        </a>
      }
    }

    @if (catalog().length) {
      <h2>Catalog</h2>
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
    h1 { font-family: var(--vos-display); margin: 4px 0 6px; }
    h2 { font-family: var(--vos-display); font-size: 1.1rem; margin: 20px 0 6px; }
    .small { font-size: 0.9rem; margin-top: 0; }
    .switcher { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
    .chip {
      border: 1px solid var(--vos-border); background: #fff; border-radius: 999px;
      padding: 8px 14px; font-weight: 600; cursor: pointer; color: var(--vos-ink);
    }
    .chip.on { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .item {
      display: block; text-decoration: none; color: inherit; cursor: pointer;
    }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .msg { margin: 6px 0 0; font-size: 0.92rem; color: var(--vos-brand); font-weight: 600; }
    .cat p { margin: 4px 0 0; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class DiagnosticsComponent implements OnInit {
  petFilter: string | null = null;
  readonly pets = signal<any[]>([]);
  readonly items = signal<any[]>([]);
  readonly catalog = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    this.petFilter = this.activePet.get();
    void this.bootstrap();
  }

  statusLabel(s: string) {
    return (s || '').replace(/_/g, ' ');
  }

  async bootstrap() {
    try {
      const pets = await this.api.pets();
      this.pets.set(pets || []);
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

  pick(id: string | null) {
    this.petFilter = id;
    if (id) this.activePet.set(id);
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set((await this.api.diagnostics(this.petFilter)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not load diagnostics');
    } finally {
      this.loading.set(false);
    }
  }
}
