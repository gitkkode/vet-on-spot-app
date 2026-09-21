import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pet-conditions',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Conditions</h1>
    <p class="vos-muted">Problem list from your care team — not a diagnosis tool.</p>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No conditions on file yet.</p>
    } @else {
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
        </article>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1.1rem; margin: 0; }
    .top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .badge {
      font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em;
      padding: 4px 8px; border-radius: 8px; background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetConditionsComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('id') || '';
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set((await this.api.conditions(this.petId)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
