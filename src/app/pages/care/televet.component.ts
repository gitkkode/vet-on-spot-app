import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';
import { ActivePetService } from '../../services/active-pet.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-televet',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <header class="head">
      <p class="eyebrow">Remote care</p>
      <h1>Talk to a Vet</h1>
      <p class="vos-muted">
        Request a remote consultation for appropriate cases. Live video is not available yet —
        a veterinarian will review your request.
      </p>
    </header>

    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @if (error()) { <div class="vos-err">{{ error() }}</div> }

    <form class="vos-card" (ngSubmit)="submit()">
      <p class="label">Which pet?</p>
      @for (p of pets(); track p.id) {
        <button type="button" class="choice" [class.on]="petId===p.id" (click)="petId=p.id">{{ p.name }}</button>
      }

      <label class="vos-field">Reason
        <textarea [(ngModel)]="reason" name="reason" rows="3" required placeholder="What would you like to discuss?"></textarea>
      </label>

      <p class="label">When?</p>
      <div class="modes">
        <button type="button" class="choice" [class.on]="mode==='immediate'" (click)="mode='immediate'">Immediate</button>
        <button type="button" class="choice" [class.on]="mode==='scheduled'" (click)="mode='scheduled'">Scheduled</button>
      </div>

      @if (mode === 'scheduled') {
        <label class="vos-field">Preferred date
          <input type="date" [(ngModel)]="preferredDate" name="preferredDate" />
        </label>
        <label class="vos-field">Preferred time
          <input type="time" [(ngModel)]="preferredTime" name="preferredTime" />
        </label>
      }

      <div class="vos-warn note">
        Tele-vet is not a substitute for emergency care. Some conditions need an in-person exam.
      </div>

      <button class="vos-btn" type="submit" [disabled]="!petId || !reason.trim() || saving()">
        {{ saving() ? 'Submitting…' : 'Request tele-vet' }}
      </button>
    </form>

    <h2>Your tele-vet requests</h2>
    @if (loadingList()) {
      <div class="vos-skel"></div>
    } @else if (!list().length) {
      <p class="vos-empty">No tele-vet requests yet.</p>
    } @else {
      @for (b of list(); track b.id) {
        <div class="vos-card item">
          <div class="row">
            <strong>{{ b.petName || 'Pet' }}</strong>
            <span class="vos-badge">{{ b.customerStatus?.label || b.status }}</span>
          </div>
          <p class="vos-muted">{{ b.reason || 'Consultation' }}</p>
          <p class="vos-muted">{{ b.scheduledDate }} {{ b.scheduledTime || '' }}</p>
          <a [routerLink]="['/bookings', b.id]">View booking</a>

          @if (pendingHomeVisit(b); as rec) {
            <div class="rec">
              <p><strong>Home visit recommended</strong></p>
              <p class="vos-muted">{{ rec.reason || 'Your veterinarian recommends an in-person visit.' }}</p>
              <button
                type="button"
                class="vos-btn vos-btn-accent"
                [disabled]="confirming()===b.id"
                (click)="confirm(b.id)"
              >
                {{ confirming()===b.id ? 'Confirming…' : 'Confirm home visit' }}
              </button>
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    .head { margin-bottom: 12px; }
    .eyebrow {
      margin: 0 0 4px; color: var(--vos-brand); letter-spacing: 0.06em;
      text-transform: uppercase; font-size: 11px; font-weight: 700;
    }
    h1 { font-family: var(--vos-display); margin: 0 0 8px; }
    h2 { font-size: 1.05rem; margin: 20px 0 10px; font-family: var(--vos-display); }
    .label {
      margin: 0 0 8px; font-size: 12px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--vos-ink-muted); font-weight: 700;
    }
    .choice {
      display: block; width: 100%; text-align: left; margin: 6px 0; padding: 12px;
      border-radius: 12px; border: 1px solid var(--vos-border); background: #fff;
      cursor: pointer; color: var(--vos-ink);
    }
    .choice.on { border-color: var(--vos-brand); background: var(--vos-brand-soft); font-weight: 700; }
    .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .modes .choice { margin: 0; text-align: center; }
    .note { margin: 12px 0; font-size: 0.92rem; }
    .item .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .item a { font-weight: 600; text-decoration: none; display: inline-block; margin-top: 6px; }
    .rec {
      margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--vos-border);
    }
    .rec .vos-btn { margin-top: 8px; }
  `],
})
export class TelevetComponent implements OnInit {
  petId = '';
  reason = '';
  mode: 'immediate' | 'scheduled' = 'immediate';
  preferredDate = '';
  preferredTime = '';

  readonly pets = signal<any[]>([]);
  readonly list = signal<any[]>([]);
  readonly loadingList = signal(true);
  readonly saving = signal(false);
  readonly confirming = signal('');
  readonly error = signal('');
  readonly ok = signal('');

  constructor(
    private api: CustomerApiService,
    private activePet: ActivePetService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.petId = this.route.snapshot.queryParamMap.get('petId') || this.activePet.get() || '';
    void this.bootstrap();
  }

  async bootstrap() {
    try {
      const pets = await this.api.pets();
      this.pets.set(pets || []);
      if (!this.petId) this.petId = this.activePet.syncFromPets(pets || []) || '';
    } catch {
      /* ignore */
    }
    await this.loadList();
  }

  pendingHomeVisit(b: any) {
    const rec = b?.details?.homeVisitRecommendation;
    if (rec?.status === 'pending_customer') return rec;
    return null;
  }

  async loadList() {
    this.loadingList.set(true);
    try {
      this.list.set((await this.api.televetList()) || []);
    } catch {
      this.list.set([]);
    } finally {
      this.loadingList.set(false);
    }
  }

  async submit() {
    if (!this.petId || !this.reason.trim()) return;
    this.saving.set(true);
    this.error.set('');
    this.ok.set('');
    try {
      const body: Record<string, unknown> = {
        petId: this.petId,
        reason: this.reason.trim(),
        mode: this.mode,
      };
      if (this.mode === 'scheduled') {
        if (this.preferredDate) body['preferredDate'] = this.preferredDate;
        if (this.preferredTime) body['preferredTime'] = this.preferredTime;
      }
      const row = await this.api.createTelevet(body);
      this.ok.set(
        row.disclaimer ||
          `Tele-vet request ${row.id} submitted. Live video is deferred — a vet will review your case.`,
      );
      this.reason = '';
      await this.loadList();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not submit tele-vet request');
    } finally {
      this.saving.set(false);
    }
  }

  async confirm(bookingId: string) {
    this.confirming.set(bookingId);
    this.error.set('');
    this.ok.set('');
    try {
      const row = await this.api.confirmHomeVisit(bookingId);
      const homeId = row.homeBooking?.id;
      this.ok.set(
        homeId
          ? `Home visit ${homeId} created from your tele-vet recommendation.`
          : 'Home visit booking created.',
      );
      await this.loadList();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Could not confirm home visit');
    } finally {
      this.confirming.set('');
    }
  }
}
