import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import { parsePetWeight, petInitial, titleCase } from '../../utils/health-records';

@Component({
  standalone: true,
  imports: [RouterLink, FormsModule],
  selector: 'app-weight-trend',
  template: `
    <a class="vos-back" [routerLink]="['/pets', petId, 'health']">← Health</a>

    <header class="head">
      <span class="avatar" aria-hidden="true">{{ petInitial(petName()) }}</span>
      <div>
        <p class="kicker">Health record</p>
        <h1>{{ titleCase(petName()) || 'Pet' }}’s Weight</h1>
        <p class="lede">Visit vitals and entries you add — not a fitness score.</p>
      </div>
    </header>

    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }

    @if (loading()) {
      <div class="vos-skel"></div>
    } @else {
      @if (points().length && chartPath()) {
        <section class="vos-card chart-card" aria-label="Weight trend">
          <div class="chart-meta">
            <div>
              <p class="label">Latest</p>
              <strong>{{ latest()?.value }} {{ latest()?.unit || 'kg' }}</strong>
            </div>
            <div>
              <p class="label">Readings</p>
              <strong>{{ points().length }}</strong>
            </div>
          </div>
          <svg class="chart" viewBox="0 0 320 140" preserveAspectRatio="none" role="img">
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FD4A29" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#FD4A29" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path [attr.d]="chartArea()" fill="url(#wg)" />
            <path [attr.d]="chartPath()" fill="none" stroke="#FD4A29" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            @for (pt of chartDots(); track pt.i) {
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="4.5" fill="#fff" stroke="#FD4A29" stroke-width="2" />
            }
          </svg>
        </section>
      }

      @if (!points().length) {
        <div class="empty">
          <div class="empty__mark" aria-hidden="true"></div>
          <h2>No weight history yet</h2>
          <p>Weights from visits will appear here. You can also log a past reading below.</p>
        </div>
      } @else {
        <h2 class="sec">History</h2>
        @for (p of points(); track trackP(p)) {
          <div class="vos-card row">
            <strong>{{ p.value }} {{ p.unit || 'kg' }}</strong>
            <span class="vos-muted">{{ (p.recordedAt || '').slice(0, 10) }}</span>
            @if (p.visitId) {
              <a [routerLink]="['/visits', p.visitId]">Visit</a>
            } @else if (p.source === 'profile') {
              <span class="tag">Profile</span>
            }
          </div>
        }
      }

      <section class="vos-card form-card">
        <h2>Add past weight</h2>
        <p class="vos-muted">Log a reading from home or an older visit.</p>
        <div class="fields">
          <label>
            Weight
            <input type="number" min="0.1" step="0.1" [(ngModel)]="draftValue" name="wval" />
          </label>
          <label>
            Unit
            <select [(ngModel)]="draftUnit" name="wunit">
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </label>
          <label>
            Date
            <input type="date" [(ngModel)]="draftDate" name="wdate" />
          </label>
        </div>
        <button type="button" class="vos-btn" [disabled]="saving()" (click)="add()">
          {{ saving() ? 'Saving…' : 'Save weight' }}
        </button>
      </section>
    }
  `,
  styles: [`
    .head { display: flex; gap: 14px; align-items: flex-start; margin: 8px 0 16px; }
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
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); }
    .sec {
      margin: 18px 0 8px; font-family: var(--vos-mono);
      font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .chart-card { margin-bottom: 12px; padding: 16px; }
    .chart-meta {
      display: flex; gap: 28px; margin-bottom: 12px;
    }
    .label {
      margin: 0; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--vos-ink-muted); font-weight: 700;
    }
    .chart { width: 100%; height: 140px; display: block; }
    .row {
      display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 12px 14px;
    }
    .row a { margin-left: auto; font-weight: 700; text-decoration: none; }
    .tag {
      margin-left: auto; font-size: 0.75rem; font-weight: 700;
      padding: 3px 8px; border-radius: 8px; background: #f3efe6; color: #5C5A55;
    }
    .empty {
      text-align: center; padding: 36px 22px; margin-bottom: 12px;
      border-radius: 24px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 50%;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin: 0 0 8px; }
    .empty p { margin: 0 auto; max-width: 36ch; color: var(--vos-ink-muted); }
    .form-card { margin-top: 8px; }
    .form-card h2 { font-size: 1.15rem; margin-bottom: 4px; }
    .fields {
      display: grid; grid-template-columns: 1fr 90px 1fr; gap: 10px; margin: 12px 0;
    }
    label {
      display: flex; flex-direction: column; gap: 4px;
      font-size: 12px; font-weight: 700; color: var(--vos-ink-muted);
    }
    input, select {
      min-height: 44px; border-radius: 12px; border: 1px solid var(--vos-border);
      padding: 8px 10px; font: inherit; color: var(--vos-ink); background: #fff;
    }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
    @media (max-width: 560px) {
      .fields { grid-template-columns: 1fr 1fr; }
      .fields label:last-child { grid-column: 1 / -1; }
    }
  `],
})
export class WeightTrendComponent implements OnInit, OnDestroy {
  readonly points = signal<any[]>([]);
  readonly petName = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  petId = '';
  draftValue: number | null = null;
  draftUnit: 'kg' | 'lbs' = 'kg';
  draftDate = new Date().toISOString().slice(0, 10);
  private sub?: Subscription;

  readonly latest = computed(() => {
    const list = this.points();
    return list.length ? list[list.length - 1] : null;
  });

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
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

  trackP(p: any) {
    return `${p.recordedAt}-${p.value}-${p.visitId || p.source || ''}`;
  }

  private sorted(list: any[]): any[] {
    return [...list].sort((a, b) => {
      const da = new Date(a.recordedAt || 0).getTime();
      const db = new Date(b.recordedAt || 0).getTime();
      return da - db;
    });
  }

  chartDots(): Array<{ i: number; x: number; y: number }> {
    const list = this.points();
    if (list.length < 1) return [];
    const vals = list.map((p) => Number(p.value) || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const w = 320;
    const h = 140;
    const pad = 16;
    return list.map((p, i) => {
      const x = list.length === 1 ? w / 2 : pad + (i / (list.length - 1)) * (w - pad * 2);
      const y = pad + (1 - ((Number(p.value) || 0) - min) / span) * (h - pad * 2);
      return { i, x, y };
    });
  }

  chartPath(): string {
    const dots = this.chartDots();
    if (!dots.length) return '';
    return dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
  }

  chartArea(): string {
    const dots = this.chartDots();
    if (dots.length < 2) return '';
    const line = dots.map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
    const last = dots[dots.length - 1];
    const first = dots[0];
    return `${line} L${last.x.toFixed(1)} 140 L${first.x.toFixed(1)} 140 Z`;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const pet = await this.api.pet(this.petId).catch(() => null);
      this.petName.set(pet?.name || '');

      let list = (await this.api.weightTrend(this.petId)) || [];
      if (!list.length) {
        const parsed = parsePetWeight(pet?.weight);
        if (parsed) {
          list = [
            {
              value: parsed.value,
              unit: parsed.unit,
              recordedAt: pet?.updatedAt || new Date().toISOString(),
              source: 'profile',
            },
          ];
        }
      }
      // Merge local extras
      const local = this.readLocal();
      const merged = this.sorted([...list, ...local.filter((l) => !list.some((x) => this.samePoint(x, l)))]);
      this.points.set(merged);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  private samePoint(a: any, b: any) {
    return (
      String(a.recordedAt || '').slice(0, 10) === String(b.recordedAt || '').slice(0, 10) &&
      Number(a.value) === Number(b.value)
    );
  }

  private localKey() {
    return `vos.weight.${this.petId}`;
  }

  private readLocal(): any[] {
    try {
      const raw = localStorage.getItem(this.localKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocal(list: any[]) {
    try {
      localStorage.setItem(this.localKey(), JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  async add() {
    const value = Number(this.draftValue);
    if (!Number.isFinite(value) || value <= 0) {
      this.error.set('Enter a valid weight.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    const body = {
      value,
      unit: this.draftUnit,
      recordedAt: this.draftDate ? `${this.draftDate}T12:00:00` : undefined,
    };
    try {
      try {
        await this.api.addWeight(this.petId, body);
      } catch {
        // Persist on pet profile + local history if vitals POST isn't available
        await this.api.updatePet(this.petId, { weight: `${value} ${this.draftUnit}` });
        const local = this.readLocal();
        local.push({
          value,
          unit: this.draftUnit,
          recordedAt: body.recordedAt || new Date().toISOString(),
          source: 'manual',
        });
        this.writeLocal(local);
      }
      this.ok.set('Weight saved.');
      this.draftValue = null;
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not save weight');
    } finally {
      this.saving.set(false);
    }
  }
}
