import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';
import {
  petInitial,
  remindersFromTimeline,
  titleCase,
} from '../../utils/health-records';
import { VosBackButtonComponent } from '../../shared/vos-back-button.component';

@Component({
  standalone: true,
  imports: [RouterLink, VosBackButtonComponent],
  selector: 'app-reminders',
  template: `
    <vos-back-button [fallback]="petId ? ['/pets', petId, 'health'] : '/health'" fallbackLabel="Health" />

    <header class="head">
      @if (petName()) {
        <span class="avatar" aria-hidden="true">{{ petInitial(petName()) }}</span>
      }
      <div>
        <p class="kicker">Health record</p>
        <h1>
          @if (petName()) {
            {{ titleCase(petName()) }}’s Reminders
          } @else {
            Reminders
          }
        </h1>
        <p class="lede">Follow-ups, boosters, and meds from your care timeline.</p>
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
      <div class="empty">
        <div class="empty__mark" aria-hidden="true"></div>
        <h2>No open reminders</h2>
        <p>After vaccines and follow-ups, care nudges show up here. You can refresh or check the timeline.</p>
        <div class="empty__actions">
          @if (petId) {
            <button type="button" class="vos-btn" [disabled]="refreshing()" (click)="refresh()">Refresh now</button>
            <a class="vos-btn vos-btn-secondary" [routerLink]="['/pets', petId, 'timeline']">View timeline</a>
          }
        </div>
      </div>
    } @else {
      @if (fromVisits()) {
        <p class="hint">Suggested from completed visits — tap Refresh to sync official reminders from your care team.</p>
      }
      @for (r of items(); track r.id) {
        <article class="vos-card">
          <p class="meta">
            <span class="badge">{{ prettyKind(r.kind) }}</span>
            @if (r.dueAt) {
              <span>Due {{ (r.dueAt || '').slice(0, 10) }}</span>
            }
            <span class="status">{{ prettyStatus(r.status) }}</span>
          </p>
          <h2>{{ r.title }}</h2>
          @if (r.body) {
            <p>{{ r.body }}</p>
          }
          @if (!r.derived) {
            <div class="actions">
              <button type="button" class="vos-btn" (click)="act(r.id, 'done')">Done</button>
              <button type="button" class="vos-btn vos-btn-secondary" (click)="act(r.id, 'snooze')">Snooze 1 day</button>
              <button type="button" class="ghost" (click)="act(r.id, 'dismissed')">Dismiss</button>
            </div>
          } @else if (r.visitId) {
            <a class="link" [routerLink]="['/visits', r.visitId]">Related visit</a>
          } @else if (petId) {
            <a class="link" [routerLink]="['/pets', petId, 'timeline']">Open timeline</a>
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
    h2 { font-size: 1.1rem; margin: 6px 0; }
    .lede { margin: 6px 0 0; color: var(--vos-ink-muted); }
    .switcher { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
    .chip {
      border: 1px solid var(--vos-border); background: var(--vos-surface);
      border-radius: 999px; padding: 8px 14px; font-weight: 600; cursor: pointer; color: var(--vos-ink);
    }
    .chip.on { background: var(--vos-brand-soft); border-color: var(--vos-brand); }
    .refresh { margin: 0 0 14px; }
    .meta {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      margin: 0; color: var(--vos-ink-muted); font-size: 0.88rem;
    }
    .badge {
      font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 8px;
      background: var(--vos-brand-soft); color: var(--vos-brand); text-transform: capitalize;
    }
    .status { text-transform: capitalize; }
    .actions { display: grid; gap: 8px; margin-top: 10px; }
    .ghost {
      min-height: var(--vos-tap); border: 1px solid var(--vos-border); background: #fff;
      border-radius: var(--vos-radius-sm); font-weight: 600; cursor: pointer; color: var(--vos-ink-muted);
    }
    .hint {
      margin: 0 0 12px; padding: 10px 12px; border-radius: 12px;
      background: #fff7e8; color: #8a5a12; font-size: 0.9rem;
    }
    .link { display: inline-block; margin-top: 8px; font-weight: 700; text-decoration: none; }
    .empty {
      text-align: center; padding: 36px 22px;
      border-radius: 24px; background: #fffef9; border: 1px solid var(--vos-border);
    }
    .empty__mark {
      width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 50%;
      background: linear-gradient(145deg, #ffe8e1, #fff5f1);
      box-shadow: inset 0 0 0 2px rgba(253, 74, 41, 0.2);
    }
    .empty h2 { margin: 0 0 8px; }
    .empty p { margin: 0 auto 18px; max-width: 36ch; color: var(--vos-ink-muted); }
    .empty__actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .linkish {
      margin-left: 8px; background: none; border: 0; color: var(--vos-brand);
      font-weight: 700; cursor: pointer;
    }
  `],
})
export class RemindersComponent implements OnInit, OnDestroy {
  readonly items = signal<any[]>([]);
  readonly pets = signal<any[]>([]);
  readonly petName = signal('');
  readonly fromVisits = signal(false);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
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
      this.petId = pm.get('id') || this.activePet.get() || '';
      if (this.petId) this.activePet.set(this.petId);
      void this.load(true);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  switchPet(id: string) {
    if (id === this.petId) return;
    this.activePet.set(id);
    void this.router.navigate(['/pets', id, 'reminders']);
  }

  prettyKind(k: string) {
    return String(k || 'care').replace(/_/g, ' ');
  }

  prettyStatus(s: string) {
    return String(s || 'open').replace(/_/g, ' ');
  }

  async load(autoRefresh = false) {
    this.loading.set(true);
    this.error.set('');
    try {
      const pets = (await this.api.pets()) || [];
      this.pets.set(pets);
      if (this.petId) {
        this.petId = this.activePet.syncFromPets(pets, this.petId) || this.petId;
      }
      const pet = pets.find((p: any) => p.id === this.petId);
      this.petName.set(pet?.name || '');

      if (autoRefresh && this.petId) {
        try {
          await this.api.refreshReminders(this.petId);
        } catch {
          /* server may not generate — fall through */
        }
      }

      let list = (await this.api.reminders(this.petId || null)) || [];
      list = list.filter((r) => !/done|dismiss|complete|closed/i.test(String(r.status || '')));

      let derived = false;
      if (!list.length && this.petId) {
        const timeline = await this.api.petTimeline(this.petId).catch(() => null);
        if (!this.petName() && timeline?.pet?.name) this.petName.set(timeline.pet.name);
        list = remindersFromTimeline(timeline);
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

  async refresh() {
    if (!this.petId) return;
    this.refreshing.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      await this.api.refreshReminders(this.petId);
      this.ok.set('Reminders refreshed.');
      await this.load(false);
    } catch (e: any) {
      // Still try timeline fallback
      await this.load(false);
      if (!this.items().length) {
        this.error.set(e?.error?.message || e?.message || 'Refresh failed');
      } else {
        this.ok.set('Showing care nudges from your visits.');
      }
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
      await this.load(false);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Action failed');
    }
  }
}
