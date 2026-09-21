import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-reminders',
  template: `
    <a class="vos-back" [routerLink]="petId ? ['/pets', petId, 'health'] : '/health'">← Health</a>
    <h1>Reminders</h1>
    <p class="vos-muted">In-app care reminders from vaccinations, meds, and follow-ups.</p>
    @if (error()) {
      <div class="vos-err">{{ error() }} <button type="button" class="linkish" (click)="load()">Retry</button></div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }
    @if (petId) {
      <button type="button" class="vos-btn vos-btn-secondary refresh" [disabled]="refreshing()" (click)="refresh()">
        {{ refreshing() ? 'Refreshing…' : 'Refresh reminders' }}
      </button>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No open reminders.</p>
    } @else {
      @for (r of items(); track r.id) {
        <article class="vos-card">
          <p class="vos-muted">{{ r.kind }} · {{ (r.dueAt || '').slice(0, 10) }} · {{ r.status }}</p>
          <h2>{{ r.title }}</h2>
          @if (r.body) {
            <p>{{ r.body }}</p>
          }
          <div class="actions">
            <button type="button" class="vos-btn" (click)="act(r.id, 'done')">Done</button>
            <button type="button" class="vos-btn vos-btn-secondary" (click)="act(r.id, 'snooze')">Snooze 1 day</button>
            <button type="button" class="ghost" (click)="act(r.id, 'dismissed')">Dismiss</button>
          </div>
        </article>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    h2 { font-size: 1.1rem; }
    .refresh { margin: 8px 0 12px; }
    .actions { display: grid; gap: 8px; margin-top: 10px; }
    .ghost {
      min-height: var(--vos-tap); border: 1px solid var(--vos-border); background: #fff;
      border-radius: var(--vos-radius-sm); font-weight: 600; cursor: pointer; color: var(--vos-ink-muted);
    }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class RemindersComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  petId = '';

  constructor(
    private api: CustomerApiService,
    private route: ActivatedRoute,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    this.petId =
      this.route.snapshot.paramMap.get('id') || this.activePet.get() || '';
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set((await this.api.reminders(this.petId || null)) || []);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async refresh() {
    if (!this.petId) return;
    this.refreshing.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.refreshReminders(this.petId);
      this.ok.set('Reminders refreshed.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Refresh failed');
    } finally {
      this.refreshing.set(false);
    }
  }

  async act(id: string, action: string) {
    this.error.set('');
    this.ok.set('');
    try {
      const body = action === 'snooze' ? { hours: 24 } : undefined;
      await this.api.reminderAction(id, action, body);
      this.ok.set('Updated.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Action failed');
    }
  }
}
