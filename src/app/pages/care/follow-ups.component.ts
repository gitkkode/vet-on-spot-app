import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-follow-ups',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <h1>Follow-ups</h1>
    @if (error()) {
      <div class="vos-err">{{ error() }}</div>
    }
    @if (ok()) {
      <div class="vos-ok">{{ ok() }}</div>
    }
    @if (loading()) {
      <div class="vos-skel"></div>
    } @else if (!items().length) {
      <p class="vos-empty">No open follow-ups. When your vet schedules one, it will show here.</p>
    } @else {
      @for (f of items(); track f.id) {
        <article class="vos-card">
          <p class="vos-muted">{{ (f.dueAt || '').slice(0, 10) }} · {{ f.petName }} · {{ f.status }}</p>
          <h2>{{ f.reason || 'Recheck' }}</h2>
          @if (f.doctorName) {
            <p>Dr. {{ f.doctorName }}</p>
          }
          @if (f.instructions) {
            <p>{{ f.instructions }}</p>
          }
          <a class="vos-btn" routerLink="/book/new" [queryParams]="{ petId: f.petId, reason: 'follow-up' }">
            Book follow-up
          </a>
          @if (f.visitId) {
            <a class="vos-btn vos-btn-secondary" [routerLink]="['/visits', f.visitId]">View visit</a>
          }
          @if (!f.customerAckAt) {
            <button type="button" class="vos-btn vos-btn-secondary" (click)="ack(f.id)">Acknowledge</button>
          }
        </article>
      }
    }
  `,
  styles: [`
    h1, h2 { margin: 8px 0; font-family: var(--vos-display); }
    .vos-btn { margin-top: 10px; display: inline-flex; }
    .vos-btn + .vos-btn { margin-left: 8px; }
  `],
})
export class FollowUpsComponent implements OnInit {
  readonly items = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly ok = signal('');

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
  ) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      this.items.set((await this.api.followUps(this.activePet.get())) || []);
    } catch (e: any) {
      this.error.set(e?.message || 'Failed');
    } finally {
      this.loading.set(false);
    }
  }

  async ack(id: string) {
    this.error.set('');
    this.ok.set('');
    try {
      const res = await this.api.ackFollowUp(id);
      this.ok.set(res?.note || 'Acknowledged.');
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not acknowledge');
    }
  }
}
