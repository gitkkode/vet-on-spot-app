import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-weight-trend',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>
    <h1>Weight</h1>
    <p class="vos-muted">Recorded visit weights — not a fitness score.</p>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!points().length) {
      <p class="vos-empty">No weight vitals recorded yet.</p>
    } @else {
      @if (maxVal() > 0) {
        <section class="vos-card chart" aria-hidden="true">
          @for (p of points(); track trackP(p)) {
            <div class="bar-wrap" [title]="label(p)">
              <div class="bar" [style.height.%]="barHeight(p)"></div>
            </div>
          }
        </section>
      }
      @for (p of points(); track trackP(p)) {
        <div class="vos-card row">
          <strong>{{ p.value }} {{ p.unit || 'kg' }}</strong>
          <span class="vos-muted">{{ (p.recordedAt || '').slice(0, 10) }}</span>
          @if (p.visitId) {
            <a [routerLink]="['/visits', p.visitId]">Visit</a>
          }
        </div>
      }
    }
  `,
  styles: [`
    h1 { margin: 8px 0; font-family: var(--vos-display); }
    .chart {
      display: flex; align-items: flex-end; gap: 4px; height: 120px;
      padding-bottom: 8px;
    }
    .bar-wrap { flex: 1; height: 100%; display: flex; align-items: flex-end; min-width: 6px; }
    .bar {
      width: 100%; background: var(--vos-brand); border-radius: 4px 4px 0 0; min-height: 4px;
    }
    .row {
      display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 12px 14px;
    }
    .row a { margin-left: auto; font-weight: 700; text-decoration: none; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class WeightTrendComponent implements OnInit {
  readonly points = signal<any[]>([]);
  readonly maxVal = signal(0);
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

  trackP(p: any) {
    return `${p.recordedAt}-${p.value}-${p.visitId || ''}`;
  }

  label(p: any) {
    return `${p.value} ${p.unit || 'kg'} · ${(p.recordedAt || '').slice(0, 10)}`;
  }

  barHeight(p: any) {
    const max = this.maxVal();
    if (!max) return 0;
    return Math.max(8, (Number(p.value) / max) * 100);
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = (await this.api.weightTrend(this.petId)) || [];
      this.points.set(list);
      this.maxVal.set(Math.max(0, ...list.map((x: any) => Number(x.value) || 0)));
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }
}
