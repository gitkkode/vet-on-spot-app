import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerApiService } from '../../services/customer-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  selector: 'app-support',
  template: `
    <a routerLink="/" class="vos-back">← Home</a>
    <h1>Need help?</h1>
    @if (ok()) { <div class="vos-ok">{{ ok() }}</div> }
    @if (error()) { <div class="vos-err">{{ error() }}</div> }
    <form class="vos-card" (ngSubmit)="submit()">
      <label class="vos-field">Topic
        <select [(ngModel)]="category" name="category">
          <option value="booking_issue">Booking issue</option>
          <option value="doctor_issue">Doctor issue</option>
          <option value="payment_issue">Payment issue</option>
          <option value="prescription_issue">Prescription issue</option>
          <option value="technical_issue">Technical issue</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="vos-field">Subject<input [(ngModel)]="subject" name="subject" required /></label>
      <label class="vos-field">Details<textarea [(ngModel)]="body" name="body" rows="4" required></textarea></label>
      <button class="vos-btn" type="submit" [disabled]="saving()">{{ saving() ? 'Sending…' : 'Submit' }}</button>
    </form>
    @if (tickets().length) {
      <h2>Your requests</h2>
      @for (t of tickets(); track t.id) {
        <div class="vos-card"><strong>{{ t.displayId }}</strong> · {{ t.status }}<p>{{ t.subject }}</p></div>
      }
    }
  `,
  styles: [`h1,h2{margin:8px 0}`],
})
export class SupportComponent implements OnInit {
  category = 'booking_issue';
  subject = '';
  body = '';
  bookingId = '';
  petId = '';
  readonly tickets = signal<any[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly ok = signal('');
  constructor(private api: CustomerApiService, private route: ActivatedRoute) {}
  ngOnInit() {
    this.bookingId = this.route.snapshot.queryParamMap.get('bookingId') || '';
    this.petId = this.route.snapshot.queryParamMap.get('petId') || '';
    void this.load();
  }
  async load() {
    try { this.tickets.set(await this.api.supportTickets() || []); } catch { /* ignore */ }
  }
  async submit() {
    this.saving.set(true); this.error.set(''); this.ok.set('');
    try {
      const t = await this.api.createSupport({
        category: this.category,
        subject: this.subject,
        body: this.body,
        bookingId: this.bookingId || undefined,
        petId: this.petId || undefined,
      });
      this.ok.set(`Request ${t.displayId} submitted.`);
      this.subject = ''; this.body = '';
      await this.load();
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Failed');
    } finally { this.saving.set(false); }
  }
}
