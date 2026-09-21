import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-pet-care-plans',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Care plans</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!plans().length) {
      <p class="vos-empty">No care plans yet. Plans appear after your vet shares one from a visit.</p>
    } @else {
      @for (p of plans(); track p.id) {
        <article class="vos-card">
          <div class="top">
            <h2>{{ p.title || 'Care plan' }}</h2>
            <span class="badge">{{ p.status }}</span>
          </div>
          @if (p.goals) {
            <p>{{ p.goals }}</p>
          }
          @if (p.instructions) {
            <p class="vos-muted">{{ p.instructions }}</p>
          }
          @if (p.visitId) {
            <a class="link" [routerLink]="['/visits', p.visitId]">Visit</a>
          }
          @for (it of p.items || []; track it.id) {
            <div class="item">
              <div>
                <strong>{{ it.title }}</strong>
                <span class="vos-muted"> · {{ it.status }}</span>
                @if (it.details) {
                  <p class="vos-muted">{{ it.details }}</p>
                }
                @if (it.dueOn) {
                  <p class="vos-muted">Due {{ it.dueOn }}</p>
                }
              </div>
              @if (it.status === 'pending') {
                <div class="actions">
                  <button type="button" class="mini" (click)="mark(it.id, 'done')">Done</button>
                  <button type="button" class="mini ghost" (click)="mark(it.id, 'skipped')">Skip</button>
                </div>
              }
            </div>
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
      font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 8px;
      background: var(--vos-brand-soft); color: var(--vos-brand);
    }
    .item {
      display: flex; justify-content: space-between; gap: 10px; align-items: flex-start;
      padding: 10px 0; border-top: 1px solid var(--vos-border);
    }
    .actions { display: flex; flex-direction: column; gap: 6px; }
    .mini {
      min-height: 36px; border-radius: 10px; border: 1px solid var(--vos-brand);
      background: var(--vos-brand-soft); font-weight: 600; cursor: pointer; padding: 6px 10px;
    }
    .mini.ghost { background: #fff; border-color: var(--vos-border); }
    .link { display: inline-block; margin: 8px 0; font-weight: 700; text-decoration: none; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class PetCarePlansComponent implements OnInit {
  readonly plans = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly ok = signal('');
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
      this.plans.set((await this.api.carePlans(this.petId)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async mark(id: string, status: 'done' | 'skipped') {
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.updateCarePlanItem(id, { status });
      this.ok.set(status === 'done' ? 'Marked done.' : 'Marked skipped.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not update');
    }
  }
}
